import { Outlet } from "@tanstack/react-router";
import { Box } from "@mantine/core";

const NonMemberLayout = () => {
  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--mantine-color-gray-0)",
      }}
    >
      <Outlet />
    </Box>
  );
};

export default NonMemberLayout;
