import React from 'react';

export default function Navigation({onSelect}){
  return (
    <nav style={{display:'flex',gap:12,padding:12,borderBottom:'1px solid #eee'}}>
      <button onClick={()=>onSelect('dashboard')}>Dashboard</button>
      <button onClick={()=>onSelect('revisiones')}>Revisiones</button>
      <button onClick={()=>onSelect('expedientes')}>Expedientes</button>
      <button onClick={()=>onSelect('acta')}>Acta</button>
    </nav>
  );
}
