import { parkingPhotoCredits } from '../lib/parking-photos';
export default function PhotoCredits() {
  return <section className="panel photo-credits" id="photo-credits"><h2>Photo credits</h2><p>Photographs show Astana neighborhoods and nearby landmarks. They do not verify a parking entrance, current site conditions or a partner agreement. Images are displayed with a responsive crop.</p><div className="photo-credit-grid">{Object.entries(parkingPhotoCredits).map(([code, photo]) => <article key={code}><a href={photo.source} target="_blank" rel="noreferrer">{photo.alt}</a><small>{photo.author} · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></small></article>)}</div></section>;
}
