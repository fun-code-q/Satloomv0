// -----------------------------------------------------------------------------
//  SAFEGUARD  ⟩  This file lets any accidental runtime import('firebase')
//               resolve to the correct modular package so nothing 404s.
// -----------------------------------------------------------------------------
export * from "firebase/app"
export { default } from "firebase/app"
