import React from 'react';

export const LabelVal = ({ label, val }: { label: string; val: React.ReactNode }) => {
  if (!val || val === 'None' || val === '{}') return null;
  return (
    <div className="flex flex-col mb-1.5">
      <span className="text-[9px] font-bold text-default-400 tracking-wider uppercase">
        {label}
      </span>
      <span className="text-xs font-medium text-white">{val}</span>
    </div>
  );
};
