import {
  DEFAULT_CHECKOUT_STATES,
  type CheckoutErrorIcon,
  type CheckoutErrorStateTheme,
  type CheckoutPaymentContentWidth,
  type CheckoutPaymentDensity,
  type CheckoutPaymentLayoutTheme,
  type CheckoutPaymentStateTheme,
  type CheckoutResultContentAlign,
  type CheckoutResultContentWidth,
  type CheckoutResultLayoutTheme,
  type CheckoutSuccessIcon,
  type CheckoutSuccessStateTheme,
  type CheckoutSurfaceTheme,
  type CheckoutTablePaymentIcon,
  type CheckoutTablePaymentStateTheme,
} from './schema'

export interface ResolvedCheckoutPaymentLayoutTheme {
  paddingX: number
  sectionGap: number
  density: CheckoutPaymentDensity
  contentWidth: CheckoutPaymentContentWidth
}

export interface ResolvedCheckoutResultLayoutTheme {
  paddingX: number
  paddingY: number
  contentGap: number
  align: CheckoutResultContentAlign
  contentWidth: CheckoutResultContentWidth
  iconSize: number
}

export interface ResolvedCheckoutPaymentStateTheme {
  title: string
  description: string
  amountLabel: string
  methodSectionTitle: string
  buyerSectionTitle: string
  buyerSectionDescription: string
  cardActionLabel: string
  tableActionLabel: string
  layout: ResolvedCheckoutPaymentLayoutTheme
}

export interface ResolvedCheckoutSuccessStateTheme {
  title: string
  description: string
  primaryActionLabel: string
  icon: CheckoutSuccessIcon
  iconColor: string
  iconBackground: string
  layout: ResolvedCheckoutResultLayoutTheme
}

export interface ResolvedCheckoutTablePaymentStateTheme {
  title: string
  description: string
  primaryActionLabel: string
  icon: CheckoutTablePaymentIcon
  iconColor: string
  iconBackground: string
  layout: ResolvedCheckoutResultLayoutTheme
}

export interface ResolvedCheckoutErrorStateTheme {
  title: string
  primaryActionLabel: string
  secondaryActionLabel: string
  icon: CheckoutErrorIcon
  iconColor: string
  iconBackground: string
  layout: ResolvedCheckoutResultLayoutTheme
}

function resolvePaymentLayout(
  fallback: CheckoutPaymentLayoutTheme,
  override: CheckoutPaymentLayoutTheme | undefined,
): ResolvedCheckoutPaymentLayoutTheme {
  return {
    paddingX: override?.paddingX ?? fallback.paddingX ?? 16,
    sectionGap: override?.sectionGap ?? fallback.sectionGap ?? 16,
    density: override?.density ?? fallback.density ?? 'standard',
    contentWidth: override?.contentWidth ?? fallback.contentWidth ?? 'standard',
  }
}

function resolveResultLayout(
  fallback: CheckoutResultLayoutTheme,
  override: CheckoutResultLayoutTheme | undefined,
): ResolvedCheckoutResultLayoutTheme {
  return {
    paddingX: override?.paddingX ?? fallback.paddingX ?? 18,
    paddingY: override?.paddingY ?? fallback.paddingY ?? 18,
    contentGap: override?.contentGap ?? fallback.contentGap ?? 16,
    align: override?.align ?? fallback.align ?? 'center',
    contentWidth: override?.contentWidth ?? fallback.contentWidth ?? 'standard',
    iconSize: override?.iconSize ?? fallback.iconSize ?? 84,
  }
}

export function resolveCheckoutPaymentState(
  surface: CheckoutSurfaceTheme | null | undefined,
): ResolvedCheckoutPaymentStateTheme {
  const override: CheckoutPaymentStateTheme | undefined = surface?.states?.payment
  return {
    title: override?.title ?? surface?.title ?? DEFAULT_CHECKOUT_STATES.payment.title,
    description: override?.description ?? surface?.subtitle ?? DEFAULT_CHECKOUT_STATES.payment.description,
    amountLabel: override?.amountLabel ?? DEFAULT_CHECKOUT_STATES.payment.amountLabel,
    methodSectionTitle: override?.methodSectionTitle ?? DEFAULT_CHECKOUT_STATES.payment.methodSectionTitle,
    buyerSectionTitle: override?.buyerSectionTitle ?? DEFAULT_CHECKOUT_STATES.payment.buyerSectionTitle,
    buyerSectionDescription: override?.buyerSectionDescription ?? DEFAULT_CHECKOUT_STATES.payment.buyerSectionDescription,
    cardActionLabel: override?.cardActionLabel ?? DEFAULT_CHECKOUT_STATES.payment.cardActionLabel,
    tableActionLabel: override?.tableActionLabel ?? DEFAULT_CHECKOUT_STATES.payment.tableActionLabel,
    layout: resolvePaymentLayout(DEFAULT_CHECKOUT_STATES.payment.layout, override?.layout),
  }
}

export function resolveCheckoutSuccessState(
  surface: CheckoutSurfaceTheme | null | undefined,
): ResolvedCheckoutSuccessStateTheme {
  const override: CheckoutSuccessStateTheme | undefined = surface?.states?.success
  return {
    title: override?.title ?? surface?.successTitle ?? DEFAULT_CHECKOUT_STATES.success.title,
    description: override?.description ?? DEFAULT_CHECKOUT_STATES.success.description,
    primaryActionLabel: override?.primaryActionLabel ?? DEFAULT_CHECKOUT_STATES.success.primaryActionLabel,
    icon: override?.icon ?? DEFAULT_CHECKOUT_STATES.success.icon,
    iconColor: override?.iconColor ?? DEFAULT_CHECKOUT_STATES.success.iconColor,
    iconBackground: override?.iconBackground ?? DEFAULT_CHECKOUT_STATES.success.iconBackground,
    layout: resolveResultLayout(DEFAULT_CHECKOUT_STATES.success.layout, override?.layout),
  }
}

export function resolveCheckoutTablePaymentState(
  surface: CheckoutSurfaceTheme | null | undefined,
): ResolvedCheckoutTablePaymentStateTheme {
  const override: CheckoutTablePaymentStateTheme | undefined = surface?.states?.tablePayment
  return {
    title: override?.title ?? DEFAULT_CHECKOUT_STATES.tablePayment.title,
    description: override?.description ?? DEFAULT_CHECKOUT_STATES.tablePayment.description,
    primaryActionLabel: override?.primaryActionLabel ?? DEFAULT_CHECKOUT_STATES.tablePayment.primaryActionLabel,
    icon: override?.icon ?? DEFAULT_CHECKOUT_STATES.tablePayment.icon,
    iconColor: override?.iconColor ?? DEFAULT_CHECKOUT_STATES.tablePayment.iconColor,
    iconBackground: override?.iconBackground ?? DEFAULT_CHECKOUT_STATES.tablePayment.iconBackground,
    layout: resolveResultLayout(DEFAULT_CHECKOUT_STATES.tablePayment.layout, override?.layout),
  }
}

export function resolveCheckoutErrorState(
  surface: CheckoutSurfaceTheme | null | undefined,
): ResolvedCheckoutErrorStateTheme {
  const override: CheckoutErrorStateTheme | undefined = surface?.states?.error
  return {
    title: override?.title ?? DEFAULT_CHECKOUT_STATES.error.title,
    primaryActionLabel: override?.primaryActionLabel ?? DEFAULT_CHECKOUT_STATES.error.primaryActionLabel,
    secondaryActionLabel: override?.secondaryActionLabel ?? DEFAULT_CHECKOUT_STATES.error.secondaryActionLabel,
    icon: override?.icon ?? DEFAULT_CHECKOUT_STATES.error.icon,
    iconColor: override?.iconColor ?? DEFAULT_CHECKOUT_STATES.error.iconColor,
    iconBackground: override?.iconBackground ?? DEFAULT_CHECKOUT_STATES.error.iconBackground,
    layout: resolveResultLayout(DEFAULT_CHECKOUT_STATES.error.layout, override?.layout),
  }
}
