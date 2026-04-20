import { LabelVal } from './SharedLabel';

export function WaypointDetailsPanel({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="col-span-2">
        <LabelVal label="Coordinates" val={data.raw_coordinates} />
      </div>
      <div className="col-span-2">
        <LabelVal
          label="Intersecting Routes"
          val={
            data.route_ids
              ? String(data.route_ids).replace(/[{"'}]/g, '')
              : data.routes
                ? String(data.routes).replace(/[{"'}]/g, '')
                : null
          }
        />
      </div>
      <div className="col-span-2">
        <LabelVal label="Remarks" val={data.remarks} />
      </div>
    </div>
  );
}
