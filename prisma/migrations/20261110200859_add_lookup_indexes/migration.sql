-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Booking_locationId_idx" ON "Booking"("locationId");

-- CreateIndex
CREATE INDEX "Booking_payoutId_idx" ON "Booking"("payoutId");

-- CreateIndex
CREATE INDEX "Booking_groupBookingId_idx" ON "Booking"("groupBookingId");

-- CreateIndex
CREATE INDEX "Booking_parentBookingId_idx" ON "Booking"("parentBookingId");

-- CreateIndex
CREATE INDEX "Booking_subsidyApplicationId_idx" ON "Booking"("subsidyApplicationId");

-- CreateIndex
CREATE INDEX "BreakdownReport_bookingId_idx" ON "BreakdownReport"("bookingId");

-- CreateIndex
CREATE INDEX "BreakdownReport_status_idx" ON "BreakdownReport"("status");

-- CreateIndex
CREATE INDEX "CooperativeMember_farmerId_idx" ON "CooperativeMember"("farmerId");

-- CreateIndex
CREATE INDEX "Dispute_bookingId_idx" ON "Dispute"("bookingId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "FarmerProfile_locationId_idx" ON "FarmerProfile"("locationId");

-- CreateIndex
CREATE INDEX "GroupBooking_leaderId_idx" ON "GroupBooking"("leaderId");

-- CreateIndex
CREATE INDEX "Machine_locationId_idx" ON "Machine"("locationId");

-- CreateIndex
CREATE INDEX "MachineImage_machineId_idx" ON "MachineImage"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_machineId_idx" ON "MaintenanceRequest"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_technicianId_idx" ON "MaintenanceRequest"("technicianId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorProfile_providerId_idx" ON "OperatorProfile"("providerId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payout_providerId_idx" ON "Payout"("providerId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_bookingId_idx" ON "Refund"("bookingId");

-- CreateIndex
CREATE INDEX "Review_machineId_idx" ON "Review"("machineId");

-- CreateIndex
CREATE INDEX "Review_operatorId_idx" ON "Review"("operatorId");

-- CreateIndex
CREATE INDEX "SubsidyApplication_farmerId_idx" ON "SubsidyApplication"("farmerId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_farmerId_idx" ON "WaitlistEntry"("farmerId");
