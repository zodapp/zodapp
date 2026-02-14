import { Suspense } from "react";
import { Outlet } from "@tanstack/react-router";

export const RootLayout = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Outlet />
    </Suspense>
  );
};
