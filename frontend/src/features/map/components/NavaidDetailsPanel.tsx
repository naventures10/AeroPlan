import type { NavAidDetails } from '../../../api/client';
import { LabelVal } from './SharedLabel';
import { CollapsibleRemarks } from './CollapsibleRemarks';

export function NavaidDetailsPanel({
  isLoadingNavaid,
  navaidDetails,
  data,
}: {
  isLoadingNavaid: boolean;
  navaidDetails: NavAidDetails | null;
  data: any;
}) {
  const displayData = navaidDetails || data;
  const remarks = displayData.remarks;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <LabelVal label="Identifier" val={displayData.ident} />
        <LabelVal label="Type" val={displayData.aid_type} />
        <LabelVal label="Frequency" val={displayData.frequency} />
        <LabelVal label="Elevation" val={displayData.elevation} />
        <div className="col-span-2">
          <LabelVal label="Coordinates" val={displayData.raw_coordinates} />
        </div>
        <div className="col-span-2">
          <LabelVal label="Operating Hours" val={displayData.hours_of_operation} />
        </div>
      </div>

      <CollapsibleRemarks remarks={remarks} />

      {isLoadingNavaid && !navaidDetails && (
        <div className="flex justify-center py-2">
          <div className="w-5 h-5 border-2 border-outline-variant border-t-teal-500 dark:border-t-cyan-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
