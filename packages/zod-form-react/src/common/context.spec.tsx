import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentType, ReactElement } from "react";
import {
  type ComponentLibrary,
  type DynamicZodFormDef,
  type ZodFormContextMergeMode,
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
    mergeMode?: ZodFormContextMergeMode;
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

  it('uses the parent component for duplicate keys with mergeMode="fallback"', () => {
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
        mergeMode: "fallback",
      },
    });

    expect(context.componentLibrary.shared).toBe(parentShared);
    expect(context.componentLibrary.parentOnly).toBe(parentOnly);
    expect(context.componentLibrary.childOnly).toBe(childOnly);
  });

  it('uses the child component for duplicate keys with mergeMode="override"', () => {
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
        mergeMode: "override",
      },
    });

    expect(context.componentLibrary.shared).toBe(childShared);
    expect(context.componentLibrary.parentOnly).toBe(parentOnly);
    expect(context.componentLibrary.childOnly).toBe(childOnly);
  });

  it("keeps merge=true compatible with override behavior", () => {
    const parentShared = createDef();
    const childShared = createDef();

    const context = renderNestedContext({
      parentComponentLibrary: {
        shared: parentShared,
      },
      childComponentLibrary: {
        shared: childShared,
      },
      childProviderProps: {
        merge: true,
      },
    });

    expect(context.componentLibrary.shared).toBe(childShared);
  });

  it('replaces the parent component library with mergeMode="replace"', () => {
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
        mergeMode: "replace",
      },
    });

    expect(context.componentLibrary.shared).toBe(childShared);
    expect(context.componentLibrary.parentOnly).toBeUndefined();
    expect(context.componentLibrary.childOnly).toBe(childOnly);
  });
});
