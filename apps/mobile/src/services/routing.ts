export type RouteResult={distanceKm:number;durationMinutes:number;provider:"osrm"};

const OSRM_BASE=process.env.EXPO_PUBLIC_ROUTING_URL||"https://router.project-osrm.org";

export async function getRoute(from:{latitude:number;longitude:number},to:{latitude:number;longitude:number}):Promise<RouteResult|null>{
  const coords=`${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const response=await fetch(`${OSRM_BASE.replace(/\/$/,"")}/route/v1/driving/${coords}?overview=false`);
  if(!response.ok)throw new Error(`Routing service returned ${response.status}`);
  const body=await response.json() as {routes?:Array<{distance?:number;duration?:number}>};
  const route=body.routes?.[0];
  if(!route?.distance||route.duration==null)return null;
  return {distanceKm:route.distance/1000,durationMinutes:route.duration/60,provider:"osrm"};
}
