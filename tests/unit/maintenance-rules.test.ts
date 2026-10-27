// Unit tests for src/lib/services/maintenance-rules.ts: engine hours of a job, the service
// alerts and the repair steps.
import { describe, expect, it } from "vitest";
import {
  getEngineHoursUsed,
  getHoursUntilService,
  getNextMaintenanceStatus,
  getNextServiceDueHours,
  getServiceState,
  isMaintenanceOpen,
  isNewServiceAlert,
} from "@/lib/services/maintenance-rules";

describe("getEngineHoursUsed", () => {
  it("counts hours worked, 2 hours per acre, and 8 hours per day", () => {
    expect(getEngineHoursUsed("PER_HOUR", 6)).toBe(6);
    expect(getEngineHoursUsed("PER_ACRE", 0.66)).toBe(1.3);
    expect(getEngineHoursUsed("PER_DAY", 2)).toBe(16);
  });
});

describe("service alerts", () => {
  it("says ok, soon (fewer than 25 hours left) or due", () => {
    expect(getServiceState({ engineHours: 820, serviceDueHours: 1000 })).toBe("ok");
    expect(getServiceState({ engineHours: 480, serviceDueHours: 500 })).toBe("soon");
    expect(getServiceState({ engineHours: 2000, serviceDueHours: 2000 })).toBe("due");
    expect(getServiceState({ engineHours: 2010, serviceDueHours: 2000 })).toBe("due");
  });

  it("counts the hours left, never below 0", () => {
    expect(getHoursUntilService({ engineHours: 480, serviceDueHours: 500 })).toBe(20);
    expect(getHoursUntilService({ engineHours: 2010, serviceDueHours: 2000 })).toBe(0);
  });

  it("sends a message only when a job moves the machine into a new alert", () => {
    expect(isNewServiceAlert("ok", "soon")).toBe(true);
    expect(isNewServiceAlert("soon", "due")).toBe(true);
    expect(isNewServiceAlert("soon", "soon")).toBe(false);
    expect(isNewServiceAlert("ok", "ok")).toBe(false);
  });

  it("sets the next service 250 engine hours after this one", () => {
    expect(getNextServiceDueHours(2010)).toBe(2260);
  });
});

describe("the repair steps", () => {
  it("goes Received -> Inspecting -> Repairing -> Fixed, and stops there", () => {
    expect(getNextMaintenanceStatus("RECEIVED")).toBe("INSPECTING");
    expect(getNextMaintenanceStatus("INSPECTING")).toBe("REPAIRING");
    expect(getNextMaintenanceStatus("REPAIRING")).toBe("FIXED");
    expect(getNextMaintenanceStatus("FIXED")).toBeNull();
  });

  it("is open until it is fixed", () => {
    expect(isMaintenanceOpen("REPAIRING")).toBe(true);
    expect(isMaintenanceOpen("FIXED")).toBe(false);
  });
});
