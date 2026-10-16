// Open signal for the onboarding modal: a tiny module-scoped store (no React state in the shell).
// Anyone may call openOnboarding(); the modal subscribes with useSyncExternalStore.
type Listener = () => void;
const listeners = new Set<Listener>();
let requestCount = 0;

export const openOnboarding = () => {
  requestCount++;
  listeners.forEach((l) => l());
};
export const subscribeOnboarding = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
// Changes each time openOnboarding() is called.
export const onboardingRequests = () => requestCount;
