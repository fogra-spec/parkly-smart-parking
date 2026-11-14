// Local-only default. Do not replace this with the hosted production URL.
// To test the unchanged website API on a phone, explicitly choose local-api and
// your development computer's private LAN URL; localhost on a phone is the phone.
export const serviceConfig:{mode:'mock'|'local-api';localApiUrl:string}={mode:'mock',localApiUrl:'http://127.0.0.1:5173'};
// Standalone Android builds have no authorized Google Maps key configured.
// Keep the interactive schematic enabled until a real Maps integration is set up.
export const nativeMapConfig={androidApiKeyConfigured:false};
