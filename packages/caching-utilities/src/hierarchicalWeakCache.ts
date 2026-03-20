type StoredValue<Value> = Exclude<Value, undefined>;
type HierarchicalWeakCacheKeys = readonly [object, ...object[]];

type CacheNode<Value> = {
  children?: WeakMap<object, CacheNode<Value>>;
  value?: StoredValue<Value>;
};

export type HierarchicalWeakCache<
  Keys extends HierarchicalWeakCacheKeys,
  Value,
> = {
  get(keys: Keys): StoredValue<Value> | undefined;
  set(keys: Keys, value: StoredValue<Value>): StoredValue<Value>;
  getOrCreate(
    keys: Keys,
    factory: () => StoredValue<Value>,
  ): StoredValue<Value>;
  has(keys: Keys): boolean;
  delete(keys: Keys): boolean;
};

function assertKeys(keys: readonly object[]): void {
  if (keys.length === 0) {
    throw new Error("hierarchicalWeakCache keys must not be empty");
  }
  for (const key of keys) {
    if (
      !((typeof key === "object" && key !== null) || typeof key === "function")
    ) {
      throw new Error("hierarchicalWeakCache keys must be objects");
    }
  }
}

function assertValue<Value>(value: StoredValue<Value>): void {
  if (value === undefined) {
    throw new Error("hierarchicalWeakCache value must not be undefined");
  }
}

export function hierarchicalWeakCache<
  Keys extends HierarchicalWeakCacheKeys,
  Value,
>(): HierarchicalWeakCache<Keys, Value> {
  const root = new WeakMap<object, CacheNode<Value>>();

  function getNode(keys: Keys): CacheNode<Value> | undefined {
    assertKeys(keys);

    const firstKey = keys[0]!;
    let node = root.get(firstKey);
    for (let index = 1; index < keys.length; index++) {
      const key = keys[index]!;
      node = node?.children?.get(key);
      if (!node) {
        return undefined;
      }
    }
    return node;
  }

  function getOrCreateNode(keys: Keys): CacheNode<Value> {
    assertKeys(keys);

    const firstKey = keys[0]!;
    const existingRootNode = root.get(firstKey);
    let node: CacheNode<Value>;
    if (existingRootNode) {
      node = existingRootNode;
    } else {
      node = {};
      root.set(firstKey, node);
    }

    for (let index = 1; index < keys.length; index++) {
      const key = keys[index]!;
      let children: WeakMap<object, CacheNode<Value>> | undefined =
        node.children;
      if (!children) {
        children = new WeakMap<object, CacheNode<Value>>();
        node.children = children;
      }

      const nextNode: CacheNode<Value> | undefined = children.get(key);
      if (nextNode) {
        node = nextNode;
        continue;
      }

      const createdNode: CacheNode<Value> = {};
      children.set(key, createdNode);
      node = createdNode;
    }

    return node;
  }

  function get(keys: Keys): StoredValue<Value> | undefined {
    return getNode(keys)?.value;
  }

  function set(keys: Keys, value: StoredValue<Value>): StoredValue<Value> {
    assertValue(value);
    const node = getOrCreateNode(keys);
    node.value = value;
    return value;
  }

  function getOrCreate(
    keys: Keys,
    factory: () => StoredValue<Value>,
  ): StoredValue<Value> {
    const cachedValue = get(keys);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const createdValue = factory();
    assertValue(createdValue);

    const node = getOrCreateNode(keys);
    if (node.value !== undefined) {
      return node.value;
    }
    node.value = createdValue;
    return createdValue;
  }

  function has(keys: Keys): boolean {
    return getNode(keys)?.value !== undefined;
  }

  function deleteValue(keys: Keys): boolean {
    const node = getNode(keys);
    if (!node || node.value === undefined) {
      return false;
    }
    delete node.value;
    return true;
  }

  return {
    get,
    set,
    getOrCreate,
    has,
    delete: deleteValue,
  };
}
