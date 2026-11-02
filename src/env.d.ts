/// <reference path="../.astro/env.d.ts" />
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    admin?: import("./lib/admin/auth").Admin;
    adminError?: string;
  }
}
