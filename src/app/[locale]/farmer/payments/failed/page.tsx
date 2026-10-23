// Farmer page: after a failed or cancelled online payment (/farmer/payments/failed?tran=<id>).
// The gateway (or the pretend bank page) sends the farmer here. The card shows what the
// database says about this payment, and a button back to the booking to try again.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PaymentResult } from "@/components/payment/payment-result";
import { requireRole } from "@/lib/auth";
import { getFarmerPayment } from "@/lib/services/payment";

type PaymentFailedPageProps = {
  searchParams: Promise<{ tran?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PaymentResult");
  return { title: t("failedTitle") };
}

export default async function PaymentFailedPage({ searchParams }: PaymentFailedPageProps) {
  const farmer = await requireRole("FARMER");
  const { tran } = await searchParams;
  const payment = tran ? await getFarmerPayment(tran, farmer.id) : null;
  if (!payment) {
    notFound(); // no such payment, or it is someone else's
  }
  return <PaymentResult payment={payment} />;
}
