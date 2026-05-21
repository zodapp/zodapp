import React, { createContext, useMemo } from "react";

export type ReactiveFieldEvent = {
  fieldPath: string;
  value: unknown;
  previousValue: unknown;
};

export type ReactiveFormContextValue = {
  onBlur?: (
    event: ReactiveFieldEvent,
  ) => boolean | undefined | Promise<boolean | undefined>;
  onConfirm?: (event: ReactiveFieldEvent) => void | Promise<void>;
};

const ReactiveFormContext = createContext<ReactiveFormContextValue>({});

export const ReactiveFormContextProvider = ({
  onBlur,
  onConfirm,
  children,
}: ReactiveFormContextValue & {
  children: React.ReactNode;
}) => {
  const value = useMemo(
    () => ({
      onBlur,
      onConfirm,
    }),
    [onBlur, onConfirm],
  );

  return (
    <ReactiveFormContext.Provider value={value}>
      {children}
    </ReactiveFormContext.Provider>
  );
};

export const useReactiveFormContext = () => {
  return React.useContext(ReactiveFormContext);
};
