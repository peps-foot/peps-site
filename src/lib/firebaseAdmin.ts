// src/lib/firebaseAdmin.ts
import 'server-only';
import * as admin from 'firebase-admin';

/**
 * VERSION "CLÉS EN DUR" — TEMPORAIRE
 * Remplace les 3 constantes ci-dessous par TES vraies infos de compte service Firebase.
 * - FIREBASE_PROJECT_ID: ex. "peps-foot"
 * - FIREBASE_CLIENT_EMAIL: ex. "firebase-adminsdk-xxxx@peps-foot.iam.gserviceaccount.com"
 * - FIREBASE_PRIVATE_KEY: le bloc complet entre BEGIN/END, avec \n comme sauts de ligne réels (pas \\n)
 */

const FIREBASE_PROJECT_ID = 'peps-foot';
const FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@peps-foot.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEuwIBADANBgkqhkiG9w0BAQEFAASCBKUwggShAgEAAoIBAQDVY0HkEekuoY8M\n2zlqQMuAnmaHXKdLdEYlTBqD4EwRCxORRomxsNBIccOfU7Af+cJe2LQqVXkOf7S1\nqsjqdi7532tltwwKbEPySON9hccBz2WBQHpliUxjcEP6l0M6nqwDNeyrQQbXte5b\nfV/ervqTrl8VR7U5JnJq8gQ/sA1osEReMGiAX09mRNUGnrbXhhpYTISaScv6vzPy\nxlw9sAtXbGZMpIsXvV3pRbdYW4k+XzdQ4pCMjodxCMPOwHTgXEiU4vRELS6kBI4/\nkgob87FGamWqwGLszNgnnoJnd7D508UCl8XtJBR/WsgIDdVJFTqBwBcTgBF4Y79C\nzq3OtxilAgMBAAECgf8b3Yuj5IyLa42RZrp+rHFKrVGP74Cd8n6q34OYRNUAWy4r\ncMsEOgnWvMg3sfcPr70doCwl0NOrVMyMSGS60sMqtSEd4MNP4a/jyK6bqKqdefEL\nLjJ+LghpyW0qTkL33eAZRWqbAu0he8jx9vLXRHwytZSqJF2Gswrr2+Lkzgu0ncpS\nXt6/7pWRjwAk75F9i1Wv5A8GztBf1VN5cygORY6Ipo/rxuw4n9bkqZ1RikoSNHBU\n0UOeqY7sn4TCqhhdAhPG4CIOmjMa2mXuD1rNv9ftVevPQdOh0/n4w7ynfg5L3rhT\nWPz3JsrzKsveh5mL4cuyHjaz9+6+fbEJqJ1kaiECgYEA+v+PPrt72KjqdSTjsvgB\nxdFdY2uWuMdUJh19qkjDKZLazfvUq1v4QUyDw4dT7ASronMlIukBkSo6orcFpwNI\n/FVQ1E1MrZX9qCGlO6ECh+OHKJo4YvPZ0Vtyj55so1DJVeX23nRnccnC1z+eVK32\nEjq6gwUH7wVSRwaVCUQBr5ECgYEA2aPU6JjOWxgRxc8tB8aI90CYQWha+9C0ySMw\nFcqe+PX74hy0nDMghPEJ0nbW+plyVVy62sKu1gUfyokXSlgoozbxoo8bzNKdJGJy\ntFVKL7vFN5ybqBTRlAMKsixKZDAhQtd6Z3rxeFkQ8kkKbb0q87yIrXHAEcW3tUwd\nQ2MHNdUCgYEApuXsIDCWh1i6ni5rYgPbWeh/iq5tyGxyne2aM/KyIyDNcY50uYUs\nLG9uZkPEH/pzDlA2b2I0cox79NpyXb2neHJajvDffcVwp63Hq0DC6Az5QJxbxiCT\nw8xk/u6/GlGLrxx87SrF5jnc3zgkVfZe23xFrP1ZayxEq4nK7CBWZqECgYABlKsL\nNXDqQHaAlUyibdK42QNCFlvy0EU/4L2MqvgUntTBg6vcJpLp5EZJ/Qr6rvqhnBbP\nV/KlI0xj0DMXGyTQaqm+oIN3LWBuzzg+DxCG4DpCeSS4R85t4MfHG4M+zwquzZnZ\n/o6abSsuV1F4EpOpSYlEmTrn5iO7cV4VCzcWMQKBgBqXLJMSooMb0tyhttFXJzA0\nJEZVk9cAYJ+L9qIUjElB5iaB3njaqVWOiKZgEUD7jnBam5+feS1QBB0bfZpKYEc4\nMoj/lfOvef7A01nvhGUp4wNmPl80xAxYs7ZxXrdbsfLInr4BaTv8Wkaf/yBqU34d\n8Gl1+r6ZYf9ovgVEuyJx\n-----END PRIVATE KEY-----\n";

// Anti double-init (dev + lambdas)
declare global {
  // eslint-disable-next-line no-var
  var __PEPS_ADMIN_APP__: admin.app.App | undefined;
}

function initAdminAppHardcoded() {
  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY, // ⚠️ Doit contenir des vrais retours à la ligne \n
    }),
  });
}

const app =
  admin.apps.length ? admin.app() : (global.__PEPS_ADMIN_APP__ ||= initAdminAppHardcoded());

export const messaging = admin.messaging(app);
