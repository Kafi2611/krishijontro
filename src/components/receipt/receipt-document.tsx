// The PDF receipt of a paid booking, made with @react-pdf/renderer.
// react-pdf has its own building blocks instead of HTML: <Document>, <Page>, <View> (like a div)
// and <Text>. They are styled with StyleSheet, a little like CSS.
// The receipt is in English only: the PDF's built-in font (Helvetica) has no Bangla letters,
// and react-pdf cannot join Bangla letters correctly yet, so Bangla text would look broken.
// renderReceiptPdf() turns the receipt into the bytes of a PDF file (see the receipt route).
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BillingUnit, PaymentMethod, WorkType } from "@/generated/prisma/enums";
import type { ReceiptData } from "@/lib/services/payment";

const GREEN = "#15803d";
const GREY = "#6b7280";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#111827" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottom: `2 solid ${GREEN}`, paddingBottom: 12 },
  appName: { fontSize: 22, fontFamily: "Helvetica-Bold", color: GREEN },
  muted: { color: GREY },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right" },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  columns: { flexDirection: "row", gap: 24 },
  column: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #d1d5db",
    marginTop: 6,
    paddingTop: 8,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40, fontSize: 9, color: GREY, textAlign: "center" },
});

/** Whole taka with thousands commas, e.g. 1517 -> "1,517 Tk". */
function taka(amount: number): string {
  return `${amount.toLocaleString("en-US")} Tk`;
}

/** A date and time in Bangladesh time, e.g. "Oct 23, 2026, 10:30 AM". */
function dhakaTime(date: Date): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(date);
}

const WORK_NAMES: Record<WorkType, string> = {
  TILLING: "Tilling",
  HARVESTING: "Harvesting",
  TRANSPLANTING: "Transplanting",
  IRRIGATION: "Irrigation",
  SEEDING: "Seeding",
  SPRAYING: "Spraying",
};

/** The amount of work is in acres, hours or days; the rate is per acre, per hour or per day. */
const UNIT_NAMES: Record<BillingUnit, string> = { PER_ACRE: "acre", PER_HOUR: "hours", PER_DAY: "days" };
const RATE_UNIT_NAMES: Record<BillingUnit, string> = { PER_ACRE: "acre", PER_HOUR: "hour", PER_DAY: "day" };

const METHOD_NAMES: Record<PaymentMethod, string> = {
  SSLCOMMERZ: "Online (SSLCommerz)",
  MOCK: "Online (test payment)",
  CASH: "Cash to the operator",
};

/** One "label ... value" line. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

/** The receipt itself: header, people, the job, the bill and a footer. */
export function ReceiptDocument({ receipt }: { receipt: ReceiptData }) {
  const unit = UNIT_NAMES[receipt.billingUnit];
  return (
    <Document title={`Receipt ${receipt.bookingCode}`} author="KrishiJontro">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>KrishiJontro</Text>
            <Text style={styles.muted}>Farm machines with a trained operator</Text>
          </View>
          <View>
            <Text style={styles.title}>Payment receipt</Text>
            <Text style={styles.muted}>{dhakaTime(receipt.paidAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Line label="Receipt no." value={receipt.receiptNo} />
          <Line label="Booking" value={receipt.bookingCode} />
          <Line label="Paid by" value={METHOD_NAMES[receipt.method]} />
        </View>

        <View style={[styles.section, styles.columns]}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Farmer</Text>
            <Text>{receipt.farmer.name}</Text>
            <Text style={styles.muted}>{receipt.farmer.phone}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Machine provider</Text>
            <Text>{receipt.provider}</Text>
            <Text style={styles.muted}>
              {receipt.machineType}: {receipt.machine}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>The work</Text>
          <Line label="Work" value={WORK_NAMES[receipt.workType]} />
          <Line label="Upazila" value={receipt.upazila} />
          <Line label="Date" value={dhakaTime(receipt.workDate)} />
          <Line label="Amount of work" value={`${receipt.quantity} ${unit}`} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill</Text>
          <Line label={`Work (rate ${taka(receipt.rate)} per ${RATE_UNIT_NAMES[receipt.billingUnit]})`} value={taka(receipt.workCharge)} />
          <Line label={`Delivery (${receipt.distanceKm} km)`} value={taka(receipt.deliveryCharge)} />
          {receipt.subsidyAmount > 0 && (
            <Line label="Government subsidy (paid by the government)" value={`- ${taka(receipt.subsidyAmount)}`} />
          )}
          <View style={styles.totalRow}>
            <Text>Total paid</Text>
            <Text>{taka(receipt.totalAmount)}</Text>
          </View>
          {receipt.refunded > 0 && <Line label="Refunded to you later" value={`- ${taka(receipt.refunded)}`} />}
        </View>

        <Text style={styles.footer}>
          This receipt was made by KrishiJontro. Please keep it. Questions? Open the booking in the app and contact
          support.
        </Text>
      </Page>
    </Document>
  );
}

/** Makes the PDF file of a receipt (the bytes of the file). Runs on the server only. */
export async function renderReceiptPdf(receipt: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument receipt={receipt} />);
}
