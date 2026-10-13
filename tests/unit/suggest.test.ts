// Unit tests for the machine suggestion rule table (src/lib/services/suggest.ts).
import { describe, expect, it } from "vitest";
import { suggestMachineType } from "@/lib/services/suggest";

describe("suggestMachineType", () => {
  it("suggests a combine harvester for big harvests and a reaper for small ones", () => {
    expect(suggestMachineType("HARVESTING", 150)?.machineTypeName).toBe("Combine Harvester");
    expect(suggestMachineType("HARVESTING", 66)?.machineTypeName).toBe("Reaper");
  });

  it("gives exactly 100 decimal of harvest to the reaper (combine only ABOVE 100)", () => {
    expect(suggestMachineType("HARVESTING", 100)?.machineTypeName).toBe("Reaper");
    expect(suggestMachineType("HARVESTING", 100.5)?.machineTypeName).toBe("Combine Harvester");
  });

  it("suggests a power tiller below 50 decimal of tilling and a tractor from 50", () => {
    expect(suggestMachineType("TILLING", 33)?.machineTypeName).toBe("Power Tiller");
    expect(suggestMachineType("TILLING", 50)?.machineTypeName).toBe("Tractor");
    expect(suggestMachineType("TILLING", 200)?.machineTypeName).toBe("Tractor");
  });

  it("suggests one machine for the other kinds of work, whatever the land size", () => {
    expect(suggestMachineType("IRRIGATION", 10)?.machineTypeName).toBe("Irrigation Pump");
    expect(suggestMachineType("TRANSPLANTING", 500)?.machineTypeName).toBe("Rice Transplanter");
    expect(suggestMachineType("SEEDING", 40)?.machineTypeName).toBe("Seeder");
    expect(suggestMachineType("SPRAYING", 80)?.machineTypeName).toBe("Sprayer");
  });

  it("returns a reason the page can turn into a sentence", () => {
    expect(suggestMachineType("HARVESTING", 150)).toEqual({
      machineTypeName: "Combine Harvester",
      reason: "bigHarvest",
    });
    expect(suggestMachineType("TILLING", 20)?.reason).toBe("smallTilling");
  });
});
