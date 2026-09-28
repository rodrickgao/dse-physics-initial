export function membershipFailure(previous, status, userId) {
  if ([401,403].includes(status)) return {active:false, revision:0, loading:false, error:true, userId};
  return {...previous, loading:false, error:true};
}
