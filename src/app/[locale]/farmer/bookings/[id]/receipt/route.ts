// GET /<locale>/farmer/bookings/<id>/receipt — downloads the PDF receipt of a paid booking.
// This is a route, not a page, because it answers with a PDF file instead of a web page.
// proxy.ts already lets only farmers into /farmer; here we check again on the server, and
// getReceiptData() only finds the booking if it is THIS farmer's and it has been paid.
import { renderReceiptPdf } from "@/components/receipt/receipt-document";
import { auth } from "@/lib/auth";
import { getReceiptData } from "@/lib/services/payment";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "FARMER") {
    return new Response("Not allowed", { status: 403 });
  }

  const { id } = await params;
  const receipt = await getReceiptData(id, session.user.id);
  if (!receipt) {
    return new Response("Not found", { status: 404 }); // not this farmer's booking, or not paid yet
  }

  const pdf = await renderReceiptPdf(receipt);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // "attachment" = download it as a file with this name (instead of opening a page)
      "Content-Disposition": `attachment; filename="receipt-${receipt.bookingCode}.pdf"`,
    },
  });
}
