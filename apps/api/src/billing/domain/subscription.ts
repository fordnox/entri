import type { Clock } from "@/kernel/clock.ts";
import { DomainEvent } from "@/kernel/events.ts";
import { type Id, newId } from "@/kernel/id.ts";
import type { WorkspaceId } from "@/workspaces/domain/workspace.ts";
import type { BillingCustomerId } from "./billing-customer.ts";
import {
  isEntitledStatus,
  parseSubscriptionStatus,
  type SubscriptionStatus,
} from "./subscription-status.ts";

export type SubscriptionId = Id<"subscription">;

export class SubscriptionUpdated extends DomainEvent {
  readonly type = "billing.subscription.updated";
  constructor(
    readonly workspaceId: WorkspaceId,
    readonly subscriptionId: SubscriptionId,
    readonly status: SubscriptionStatus,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}

export class SubscriptionCanceled extends DomainEvent {
  readonly type = "billing.subscription.canceled";
  constructor(
    readonly workspaceId: WorkspaceId,
    readonly subscriptionId: SubscriptionId,
    occurredAt: Date,
  ) {
    super(occurredAt);
  }
}

export interface SubscriptionSyncInput {
  status: string;
  priceId: string;
  planKey: string | null;
  quantity: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
}

export class Subscription {
  private events: DomainEvent[] = [];

  private constructor(
    public readonly id: SubscriptionId,
    public readonly workspaceId: WorkspaceId,
    public readonly billingCustomerId: BillingCustomerId,
    public readonly provider: string,
    public readonly providerSubscriptionId: string,
    private _status: SubscriptionStatus,
    private _priceId: string,
    private _planKey: string | null,
    private _quantity: number,
    private _currentPeriodStart: Date,
    private _currentPeriodEnd: Date,
    private _cancelAtPeriodEnd: boolean,
    private _canceledAt: Date | null,
    private _trialEndsAt: Date | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static createFromProvider(
    input: {
      workspaceId: WorkspaceId;
      billingCustomerId: BillingCustomerId;
      provider: string;
      providerSubscriptionId: string;
      sync: SubscriptionSyncInput;
    },
    clock: Clock,
  ): Subscription {
    const now = clock.now();
    const status = parseSubscriptionStatus(input.sync.status);
    const sub = new Subscription(
      newId("subscription"),
      input.workspaceId,
      input.billingCustomerId,
      input.provider,
      input.providerSubscriptionId,
      status,
      input.sync.priceId,
      input.sync.planKey,
      input.sync.quantity,
      input.sync.currentPeriodStart,
      input.sync.currentPeriodEnd,
      input.sync.cancelAtPeriodEnd,
      input.sync.canceledAt,
      input.sync.trialEndsAt,
      now,
      now,
    );
    sub.events.push(
      new SubscriptionUpdated(input.workspaceId, sub.id, status, now),
    );
    return sub;
  }

  static rehydrate(props: {
    id: SubscriptionId;
    workspaceId: WorkspaceId;
    billingCustomerId: BillingCustomerId;
    provider: string;
    providerSubscriptionId: string;
    status: SubscriptionStatus;
    priceId: string;
    planKey: string | null;
    quantity: number;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    trialEndsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Subscription {
    return new Subscription(
      props.id,
      props.workspaceId,
      props.billingCustomerId,
      props.provider,
      props.providerSubscriptionId,
      props.status,
      props.priceId,
      props.planKey,
      props.quantity,
      props.currentPeriodStart,
      props.currentPeriodEnd,
      props.cancelAtPeriodEnd,
      props.canceledAt,
      props.trialEndsAt,
      props.createdAt,
      props.updatedAt,
    );
  }

  get status(): SubscriptionStatus {
    return this._status;
  }
  get priceId(): string {
    return this._priceId;
  }
  get planKey(): string | null {
    return this._planKey;
  }
  get quantity(): number {
    return this._quantity;
  }
  get currentPeriodStart(): Date {
    return this._currentPeriodStart;
  }
  get currentPeriodEnd(): Date {
    return this._currentPeriodEnd;
  }
  get cancelAtPeriodEnd(): boolean {
    return this._cancelAtPeriodEnd;
  }
  get canceledAt(): Date | null {
    return this._canceledAt;
  }
  get trialEndsAt(): Date | null {
    return this._trialEndsAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  isEntitled(): boolean {
    return isEntitledStatus(this._status);
  }

  sync(input: SubscriptionSyncInput, clock: Clock): void {
    const nextStatus = parseSubscriptionStatus(input.status);
    const wasEntitled = this.isEntitled();
    this._status = nextStatus;
    this._priceId = input.priceId;
    this._planKey = input.planKey;
    this._quantity = input.quantity;
    this._currentPeriodStart = input.currentPeriodStart;
    this._currentPeriodEnd = input.currentPeriodEnd;
    this._cancelAtPeriodEnd = input.cancelAtPeriodEnd;
    this._canceledAt = input.canceledAt;
    this._trialEndsAt = input.trialEndsAt;
    this._updatedAt = clock.now();

    this.events.push(
      new SubscriptionUpdated(
        this.workspaceId,
        this.id,
        nextStatus,
        this._updatedAt,
      ),
    );

    if (wasEntitled && nextStatus === "canceled") {
      this.events.push(
        new SubscriptionCanceled(this.workspaceId, this.id, this._updatedAt),
      );
    }
  }

  pullEvents(): DomainEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
