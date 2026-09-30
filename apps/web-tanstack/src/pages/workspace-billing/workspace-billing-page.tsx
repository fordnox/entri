import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckIcon, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import type {
  BillingPlanDTO,
  BillingProviderKeyDTO,
  SubscriptionStatusDTO,
  WorkspaceBillingDTO,
} from "@orbit/shared/dto";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@orbit/ui/alert-dialog";
import { Button } from "@orbit/ui/button";
import { Skeleton } from "@orbit/ui/skeleton";
import { toastManager } from "@orbit/ui/toast";
import { ApiError, api } from "@/lib/api/client";
import { configQueryOptions } from "@/lib/queries/config";
import { useCan } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { useWorkspaceSlug } from "@/lib/use-workspace-slug";
import { useWorkspace } from "@/lib/workspace";
import { SettingsSection } from "@/pages/workspace-settings/shared";

export function WorkspaceBillingPage() {
  const ws = useWorkspace();
  const workspaceSlug = useWorkspaceSlug() ?? ws?.slug;
  const canView = useCan("billing.view");
  const canManage = useCan("billing.manage");

  const configQuery = useQuery(configQueryOptions);
  const billingProviderEnabled = configQuery.data?.billing.enabled ?? false;
  const billingProvider = configQuery.data?.billing.provider ?? null;

  const billingQuery = useQuery({
    queryKey: queryKeys.billing(workspaceSlug ?? ""),
    queryFn: () => {
      if (!workspaceSlug) throw new Error("missing slug");
      return api.billing.get(workspaceSlug);
    },
    enabled: Boolean(workspaceSlug) && canView && billingProviderEnabled,
    staleTime: 15_000,
  });

  if (!ws || !workspaceSlug) return null;

  if (!canView) {
    return (
      <div className="space-y-10">
        <SettingsSection
          title="Billing"
          description="Plans, invoices, and payment method."
        >
          <EmptyNotice>
            You don't have permission to view billing for this workspace.
          </EmptyNotice>
        </SettingsSection>
      </div>
    );
  }

  if (!billingProviderEnabled) {
    return (
      <div className="space-y-10">
        <SettingsSection
          title="Billing"
          description="Plans, invoices, and payment method."
        >
          <EmptyNotice>
            No billing provider is configured for this deployment. Set the{" "}
            <code className="mx-1 font-mono text-[12px]">BILLING_PROVIDER</code>{" "}
            environment variable to one of{" "}
            <code className="font-mono text-[12px]">stripe</code>,{" "}
            <code className="font-mono text-[12px]">polar</code>, or{" "}
            <code className="font-mono text-[12px]">dodo</code> on the API to
            enable this section.
          </EmptyNotice>
        </SettingsSection>
      </div>
    );
  }

  if (billingQuery.isLoading) {
    return (
      <div className="space-y-10">
        <SettingsSection
          title="Billing"
          description="Plans, invoices, and payment method."
        >
          <Skeleton className="h-40 w-full rounded-xl" />
        </SettingsSection>
      </div>
    );
  }

  if (billingQuery.isError || !billingQuery.data) {
    return (
      <div className="space-y-10">
        <SettingsSection
          title="Billing"
          description="Plans, invoices, and payment method."
        >
          <EmptyNotice>
            Could not load billing.{" "}
            {billingQuery.error instanceof ApiError
              ? billingQuery.error.message
              : "Try again in a moment."}
          </EmptyNotice>
        </SettingsSection>
      </div>
    );
  }

  const billing = billingQuery.data;

  return (
    <div className="space-y-10">
      {billing.subscription ? (
        <CurrentSubscriptionSection
          billing={billing}
          workspaceSlug={workspaceSlug}
          canManage={canManage}
          provider={billingProvider}
        />
      ) : (
        <PlanPickerSection
          billing={billing}
          workspaceSlug={workspaceSlug}
          canManage={canManage}
          provider={billingProvider}
        />
      )}
    </div>
  );
}

function EmptyNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-[13px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Current subscription                                                       */
/* -------------------------------------------------------------------------- */

function CurrentSubscriptionSection({
  billing,
  workspaceSlug,
  canManage,
  provider,
}: {
  billing: WorkspaceBillingDTO;
  workspaceSlug: string;
  canManage: boolean;
  provider: BillingProviderKeyDTO | null;
}) {
  const sub = billing.subscription!;
  const plan = billing.availablePlans.find((p) => p.priceId === sub.priceId);
  const [portalBusy, setPortalBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const queryClient = useQueryClient();

  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const { redirectUrl } = await api.billing.portal(workspaceSlug, {
        returnUrl: window.location.href,
      });
      window.location.assign(redirectUrl);
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not open portal",
        description: err instanceof ApiError ? err.message : undefined,
        timeout: 5000,
      });
      setPortalBusy(false);
    }
  };

  const runCancel = async () => {
    setCancelBusy(true);
    try {
      await api.billing.cancel(workspaceSlug, { atPeriodEnd: true });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.billing(workspaceSlug),
      });
      toastManager.add({
        type: "success",
        title: "Cancellation scheduled",
        description: "Your plan will end at the end of the current period.",
        timeout: 4000,
      });
      setCancelOpen(false);
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not cancel",
        description: err instanceof ApiError ? err.message : undefined,
        timeout: 5000,
      });
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <>
      <SettingsSection
        title="Current plan"
        description="The subscription attached to this workspace."
      >
        <div className="space-y-4 rounded-xl bg-card/40 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold leading-none">
                  {plan?.name ?? sub.planKey ?? "Custom plan"}
                </h3>
                <StatusBadge status={sub.status} />
                {sub.cancelAtPeriodEnd ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-600 uppercase tracking-wider dark:text-amber-400">
                    Canceling
                  </span>
                ) : null}
              </div>
              {plan?.description ? (
                <p className="mt-1 text-[13px] text-muted-foreground [text-wrap:pretty]">
                  {plan.description}
                </p>
              ) : null}
            </div>
            {plan ? (
              <div className="shrink-0 text-right">
                <div className="text-[20px] font-semibold tabular-nums leading-none">
                  {formatAmount(plan.unitAmount, plan.currency)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  per {formatInterval(plan)}
                  {sub.quantity > 1 ? ` × ${sub.quantity}` : ""}
                </div>
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4 text-[12px]">
            <Fact label="Seats" value={String(sub.quantity)} />
            <Fact
              label={sub.cancelAtPeriodEnd ? "Ends" : "Renews"}
              value={formatDate(sub.currentPeriodEnd)}
            />
            {sub.trialEndsAt ? (
              <Fact label="Trial ends" value={formatDate(sub.trialEndsAt)} />
            ) : null}
            <Fact label="Period started" value={formatDate(sub.currentPeriodStart)} />
            <Fact label="Provider" value={formatProviderName(provider)} />
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={openPortal}
              disabled={!canManage || portalBusy}
              className="gap-2"
            >
              {portalBusy ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <ExternalLinkIcon className="size-3.5" />
              )}
              {portalButtonLabel(provider)}
            </Button>
            {!sub.cancelAtPeriodEnd ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCancelOpen(true)}
                disabled={!canManage}
                className="text-muted-foreground"
              >
                Cancel plan
              </Button>
            ) : null}
            {!canManage ? (
              <span className="ml-auto text-[11px] text-muted-foreground">
                Requires <code className="font-mono">billing.manage</code>.
              </span>
            ) : null}
          </div>
        </div>
      </SettingsSection>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your plan stays active until{" "}
              <strong>{formatDate(sub.currentPeriodEnd)}</strong>, then this
              workspace loses access. You can reactivate from the portal
              before then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" render={<AlertDialogClose />} disabled={cancelBusy}>
              Keep plan
            </Button>
            <Button
              variant="destructive"
              onClick={runCancel}
              disabled={cancelBusy}
            >
              {cancelBusy ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : null}
              Schedule cancellation
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan picker                                                                */
/* -------------------------------------------------------------------------- */

function PlanPickerSection({
  billing,
  workspaceSlug,
  canManage,
  provider,
}: {
  billing: WorkspaceBillingDTO;
  workspaceSlug: string;
  canManage: boolean;
  provider: BillingProviderKeyDTO | null;
}) {
  const [busyPlanKey, setBusyPlanKey] = useState<string | null>(null);

  if (billing.availablePlans.length === 0) {
    return (
      <SettingsSection
        title="Billing"
        description="Plans, invoices, and payment method."
      >
        <EmptyNotice>
          No plans are configured in the billing catalog yet. Add entries to
          <code className="mx-1 font-mono text-[12px]">BILLING_PLANS</code> on
          the API (or whatever catalog source the deployment uses) to list
          them here.
        </EmptyNotice>
      </SettingsSection>
    );
  }

  const startCheckout = async (plan: BillingPlanDTO) => {
    setBusyPlanKey(plan.key);
    try {
      const { redirectUrl } = await api.billing.checkout(workspaceSlug, {
        priceId: plan.priceId,
        quantity: 1,
        successUrl: `${window.location.origin}/d/${workspaceSlug}/billing`,
        cancelUrl: window.location.href,
      });
      window.location.assign(redirectUrl);
    } catch (err) {
      toastManager.add({
        type: "error",
        title: "Could not start checkout",
        description: err instanceof ApiError ? err.message : undefined,
        timeout: 5000,
      });
      setBusyPlanKey(null);
    }
  };

  return (
    <SettingsSection
      title="Choose a plan"
      description={`Pick a plan to activate this workspace. You'll be redirected to ${formatProviderName(provider)} to complete checkout.`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {billing.availablePlans.map((plan) => {
          const busy = busyPlanKey === plan.key;
          return (
            <div
              key={plan.key}
              className="flex flex-col gap-3 rounded-xl bg-card/40 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
            >
              <div className="space-y-1">
                <h3 className="text-[14px] font-semibold leading-none">{plan.name}</h3>
                {plan.description ? (
                  <p className="text-[12px] text-muted-foreground leading-relaxed [text-wrap:pretty]">
                    {plan.description}
                  </p>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[22px] font-semibold tabular-nums leading-none">
                  {formatAmount(plan.unitAmount, plan.currency)}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  / {formatInterval(plan)}
                </span>
              </div>
              {plan.features.length > 0 ? (
                <ul className="mt-1 space-y-1 text-[12px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-muted-foreground [text-wrap:pretty]">{f}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button
                size="sm"
                className="mt-auto"
                onClick={() => startCheckout(plan)}
                disabled={!canManage || busy}
              >
                {busy ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : null}
                {busy ? "Redirecting…" : `Start ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      {!canManage ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Starting a plan requires <code className="font-mono">billing.manage</code>.
        </p>
      ) : null}
    </SettingsSection>
  );
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatusDTO }) {
  const { tone, label } = STATUS_PRESENTATION[status];
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}

const STATUS_PRESENTATION: Record<
  SubscriptionStatusDTO,
  { label: string; tone: string }
> = {
  trialing: {
    label: "Trial",
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  active: {
    label: "Active",
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  past_due: {
    label: "Past due",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  unpaid: {
    label: "Unpaid",
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  canceled: {
    label: "Canceled",
    tone: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  incomplete: {
    label: "Incomplete",
    tone: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  incomplete_expired: {
    label: "Expired",
    tone: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
  paused: {
    label: "Paused",
    tone: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
};

function formatAmount(unitAmountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: unitAmountCents % 100 === 0 ? 0 : 2,
    }).format(unitAmountCents / 100);
  } catch {
    return `${(unitAmountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatInterval(plan: Pick<BillingPlanDTO, "interval" | "intervalCount">): string {
  const name =
    plan.interval === "day"
      ? "day"
      : plan.interval === "week"
        ? "week"
        : plan.interval === "month"
          ? "month"
          : "year";
  return plan.intervalCount === 1 ? name : `${plan.intervalCount} ${name}s`;
}

/**
 * Pretty provider names the UI uses for copy. Falls back to the raw key
 * for custom providers so downstream deployments don't get "Checkout"
 * with an empty provider name.
 */
function formatProviderName(provider: BillingProviderKeyDTO | null): string {
  if (!provider) return "the payment provider";
  if (provider === "stripe") return "Stripe";
  if (provider === "polar") return "Polar";
  if (provider === "dodo") return "Dodo Payments";
  return provider;
}

/**
 * Button label reads naturally regardless of provider: "Manage in Stripe
 * portal" / "Manage in Polar portal" / "Manage in Dodo portal". When the
 * provider is unknown we keep the old generic copy.
 */
function portalButtonLabel(provider: BillingProviderKeyDTO | null): string {
  if (!provider) return "Manage in portal";
  return `Manage in ${formatProviderName(provider)} portal`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
