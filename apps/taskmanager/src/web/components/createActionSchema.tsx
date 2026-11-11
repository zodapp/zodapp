import React from "react";
import { ActionIcon } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { zfReact } from "@zodapp/zod-form-react";
import styles from "./createActionSchema.module.css";

export const ACTION_COLUMN_WIDTH = 40;

type ActionConfig<Row> = {
  getParams: (item: Row) => LinkProps;
  label?: string;
  icon?: React.ReactNode;
  width?: number;
};

export const createActionSchema = <Row,>({
  getParams,
  label = "詳細",
  icon = <IconArrowRight size={16} />,
  width = ACTION_COLUMN_WIDTH,
}: ActionConfig<Row>) => {
  return zfReact
    .computed()
    .register(zfReact.computed.registry, {
      label,
      width,
      align: "center" as const,
      compute: (row: Row) => {
        const linkProps = getParams(row);
        return (
          <Link {...linkProps} className={styles.actionLink}>
            <ActionIcon
              variant="filled"
              color="var(--mantine-primary-color-filled)"
              aria-label={label}
              size={28}
              radius="xl"
            >
              {icon}
            </ActionIcon>
          </Link>
        );
      },
    })
    .optional();
};
