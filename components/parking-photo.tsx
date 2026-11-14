'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { photoForLot } from '../lib/parking-photos';
import type { Lot } from '../lib/contracts';

export default function ParkingPhoto({ lot, variant = 'card' }: { lot: Pick<Lot, 'id' | 'code'>; variant?: 'card' | 'detail' }) {
  const photo = photoForLot(lot), [failed, setFailed] = useState(false);
  return <span className={'facility-photo ' + variant}>
    {failed ? <span className="photo-unavailable"><Camera size={28} />Photo temporarily unavailable</span> : <Image src={photo.src} alt={photo.alt + ' — area photograph, not a verified parking entrance'} width={1280} height={850} sizes={variant === 'card' ? '(max-width: 760px) 100vw, 420px' : '(max-width: 760px) 100vw, 500px'} unoptimized onError={() => setFailed(true)} />}
    <span className="photo-context">{photo.caption}</span>
  </span>;
}
