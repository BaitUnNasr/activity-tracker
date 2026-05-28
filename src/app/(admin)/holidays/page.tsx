import { fetchHolidays } from "./actions";
import { HolidaysClient } from "./_components/holidays-client";

export default async function HolidaysPage() {
  const holidays = await fetchHolidays();

  return (
    <div className="mt-6">
      <HolidaysClient initialHolidays={holidays} />
    </div>
  );
}
