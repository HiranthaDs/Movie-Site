import React from 'react';

export default function AppleBrand({size=24,className=''}){
  return <img className={`apple-brand-icon ${className}`} src="/icons/apple-brand.svg" width={size} height={size} alt="" aria-hidden="true"/>;
}
