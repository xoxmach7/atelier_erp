import React, { createContext, useContext, useState } from 'react';
import type { RoleKey } from '../types/work';

interface DemoRoleContextType {
  role: RoleKey;
  setRole: (role: RoleKey) => void;
}

const DemoRoleContext = createContext<DemoRoleContextType>({
  role: 'owner',
  setRole: () => {},
});

export function DemoRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<RoleKey>('owner');
  return (
    <DemoRoleContext.Provider value={{ role, setRole }}>
      {children}
    </DemoRoleContext.Provider>
  );
}

export function useDemoRole() {
  return useContext(DemoRoleContext);
}
