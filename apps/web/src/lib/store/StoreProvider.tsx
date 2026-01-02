'use client';

import { useRef, useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistStore } from 'redux-persist';
import { makeStore, AppStore } from './store';
import type { Persistor } from 'redux-persist';

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const storeRef = useRef<AppStore>();
  const persistorRef = useRef<Persistor | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  // Only create persistor once on client side
  if (typeof window !== 'undefined' && !persistorRef.current) {
    persistorRef.current = persistStore(storeRef.current);
  }

  return (
    <Provider store={storeRef.current}>
      {isClient && persistorRef.current ? (
        <PersistGate loading={null} persistor={persistorRef.current}>
          {children}
        </PersistGate>
      ) : (
        children
      )}
    </Provider>
  );
}
