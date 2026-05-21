import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentType, ReactElement } from "react";
import {
  type ComponentLibrary,
  type DynamicZodFormDef,
  useZodFormContext,
  ZodFormContextProvider,
} from "./context";

const createDef = (): DynamicZodFormDef => () => ({
  component: () => null,
});

const renderContext = (
  createElement: (CaptureContext: ComponentType) => ReactElement,
) => {
  let capturedContext: { componentLibrary: ComponentLibrary } | undefined;

  const CaptureContext = () => {
    const context = useZodFormContext();
    capturedContext = { componentLibrary: context.componentLibrary };
    return null;
  };

  renderToStaticMarkup(<>{createElement(CaptureContext)}</>);

  if (!capturedContext) {
    throw new Error("ZodFormContext was not captured");
  }

  return capturedContext;
};

describe("ZodFormContextProvider", () => {
  type ChildProviderProps = {
    merge?: true;
  };

  const renderNestedContext = ({
    parentComponentLibrary,
    childComponentLibrary,
    childProviderProps,
  }: {
    parentComponentLibrary: ComponentLibrary;
    childComponentLibrary: ComponentLibrary;
    childProviderProps?: ChildProviderProps;
  }) =>
    renderContext((CaptureContext) => (
      <ZodFormContextProvider componentLibrary={parentComponentLibrary}>
        <ZodFormContextProvider
          componentLibrary={childComponentLibrary}
          {...childProviderProps}
        >
          <CaptureContext />
        </ZodFormContextProvider>
      </ZodFormContextProvider>
    ));

  it("merges parent and child component libraries with merge=true", () => {
    const parentShared = createDef();
    const childShared = createDef();
    const parentOnly = createDef();
    const childOnly = createDef();

    const context = renderNestedContext({
      parentComponentLibrary: {
        shared: parentShared,
        parentOnly,
      },
      childComponentLibrary: {
        shared: childShared,
        childOnly,
      },
      childProviderProps: {
        merge: true,
      },
    });

    expect(context.componentLibrary.shared).toBe(childShared);
    expect(context.componentLibrary.parentOnly).toBe(parentOnly);
    expect(context.componentLibrary.childOnly).toBe(childOnly);
  });

  it("replaces the parent component library without merge", () => {
    const parentShared = createDef();
    const childShared = createDef();
    const parentOnly = createDef();
    const childOnly = createDef();

    const context = renderNestedContext({
      parentComponentLibrary: {
        shared: parentShared,
        parentOnly,
      },
      childComponentLibrary: {
        shared: childShared,
        childOnly,
      },
    });

    expect(context.componentLibrary.shared).toBe(childShared);
    expect(context.componentLibrary.parentOnly).toBeUndefined();
    expect(context.componentLibrary.childOnly).toBe(childOnly);
  });
});
