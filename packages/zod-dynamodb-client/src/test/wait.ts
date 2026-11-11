/** 状態が条件を満たすまで待つ。`timeout` を指定すると、過ぎたら失敗する */
export const waitFor = <T>(
  store: { getState(): T; subscribe(l: () => void): () => void },
  predicate: (state: T) => boolean,
  timeout?: number,
): Promise<T> =>
  new Promise((resolve, reject) => {
    if (predicate(store.getState())) return resolve(store.getState());
    const timer =
      timeout === undefined
        ? undefined
        : setTimeout(() => {
            off();
            reject(new Error(`timeout: ${JSON.stringify(store.getState())}`));
          }, timeout);
    const off = store.subscribe(() => {
      if (predicate(store.getState())) {
        off();
        clearTimeout(timer);
        resolve(store.getState());
      }
    });
  });
