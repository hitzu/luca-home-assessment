import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type StudentPayload = {
  studentId: string;
  payload: Record<string, unknown>;
};

export type GovBatchResultItem = {
  studentId: string;
  status: 'ACCEPTED' | 'REJECTED';
  externalRecordId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type GovBatchResult = {
  batchId: string;
  tenantId: string;
  periodId: string;
  status: 'ACCEPTED' | 'REJECTED';
  results: GovBatchResultItem[];
};

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

type CircuitBreaker = {
  state: CircuitState;
  consecutiveFailures: number;
  openedAtMs: number | null;
  probeInFlight: boolean;
};

export type GovApiCircuitStatus = {
  tenantId: string;
  state: CircuitState;
  consecutiveFailures: number;
  openedAtMs: number | null;
  probeInFlight: boolean;
  openMsRemaining: number | null;
};

@Injectable()
export class GovApiClient {
  private readonly breakersByTenant = new Map<string, CircuitBreaker>();

  getCircuitStatus(tenantId: string): GovApiCircuitStatus {
    const breaker = this.getBreaker(tenantId);
    const nowMs = Date.now();
    const openMsRemaining =
      breaker.state === 'OPEN' && breaker.openedAtMs
        ? Math.max(0, this.getCircuitOpenMs() - (nowMs - breaker.openedAtMs))
        : null;
    return {
      tenantId,
      state: breaker.state,
      consecutiveFailures: breaker.consecutiveFailures,
      openedAtMs: breaker.openedAtMs,
      probeInFlight: breaker.probeInFlight,
      openMsRemaining,
    };
  }

  async sendBatch(
    tenantId: string,
    periodId: string,
    students: StudentPayload[],
  ): Promise<GovBatchResult> {
    const breaker = this.getBreaker(tenantId);
    this.assertCircuitAllowsRequest(tenantId, breaker);
    // o en dado caso aqui? ya sabemos que esta abierto, por lo que no se va a hacer la llamada y hacer el throw de ServiceUnavailableException

    if (breaker.state === 'OPEN') {
      throw new ServiceUnavailableException(
        `Gov API circuit breaker open for tenant ${tenantId}`,
      );
    }

    const url = this.getBaseUrl() + '/batch';
    try {
      const response = await this.fetchJson<GovBatchResult>(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, periodId, students }),
      });
      this.onSuccess(breaker);
      return response;
    } catch (error) {
      this.onFailure(breaker);
      throw this.normalizeError(error);
    } finally {
      if (breaker.state === 'HALF_OPEN') {
        breaker.probeInFlight = false;
      }
    }
  }

  private getBreaker(tenantId: string): CircuitBreaker {
    const existing = this.breakersByTenant.get(tenantId);
    if (existing) {
      return existing;
    }
    const created: CircuitBreaker = {
      state: 'CLOSED',
      consecutiveFailures: 0,
      openedAtMs: null,
      probeInFlight: false,
    };
    this.breakersByTenant.set(tenantId, created);
    return created;
  }

  private assertCircuitAllowsRequest(
    tenantId: string,
    breaker: CircuitBreaker,
  ): void {
    if (breaker.state === 'CLOSED') {
      return;
    }
    const nowMs = Date.now();
    if (breaker.state === 'OPEN') {
      const openedAtMs = breaker.openedAtMs ?? nowMs;
      const elapsedMs = nowMs - openedAtMs;
      if (elapsedMs < this.getCircuitOpenMs()) {
        throw new ServiceUnavailableException(
          `Gov API circuit breaker open for tenant ${tenantId}`,
        );
      }
      breaker.state = 'HALF_OPEN';
      breaker.probeInFlight = false;
    }
    if (breaker.state === 'HALF_OPEN') {
      if (breaker.probeInFlight) {
        throw new ServiceUnavailableException(
          `Gov API circuit breaker half-open (probe in flight) for tenant ${tenantId}`,
        );
      }
      breaker.probeInFlight = true;
    }
  }

  private onSuccess(breaker: CircuitBreaker): void {
    breaker.state = 'CLOSED';
    breaker.consecutiveFailures = 0;
    breaker.openedAtMs = null;
    breaker.probeInFlight = false;
  }

  private onFailure(breaker: CircuitBreaker): void {
    breaker.consecutiveFailures += 1;
    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'OPEN';
      breaker.openedAtMs = Date.now();
      breaker.probeInFlight = false;
      return;
    }
    if (breaker.consecutiveFailures >= this.getFailureThreshold()) {
      breaker.state = 'OPEN';
      breaker.openedAtMs = Date.now();
      breaker.probeInFlight = false;
    }
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof ServiceUnavailableException) {
      return error;
    }
    if (error instanceof Error) {
      return new BadGatewayException(error.message);
    }
    return new BadGatewayException('Gov API request failed');
  }

  private getBaseUrl(): string {
    const raw = process.env.GOV_API_BASE_URL;
    if (!raw) {
      throw new Error('GOV_API_BASE_URL is required');
    }
    return raw.replace(/\/$/, '');
  }

  private getTimeoutMs(): number {
    const parsed = Number(process.env.GOV_API_TIMEOUT_MS ?? '2000');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
  }

  private getFailureThreshold(): number {
    const parsed = Number(process.env.GOV_API_CB_FAILURE_THRESHOLD ?? '3');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
  }

  private getCircuitOpenMs(): number {
    const parsed = Number(process.env.GOV_API_CB_OPEN_MS ?? '5000');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
  }

  private async fetchJson<T>(
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.getTimeoutMs());
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok) {
        const body = contentType.includes('application/json')
          ? JSON.stringify(await res.json())
          : await res.text();
        throw new Error(`Gov API ${res.status}: ${body}`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error('Gov API response is not JSON');
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

