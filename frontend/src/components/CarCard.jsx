import { capitalize, formatPrice, typeLabel } from '../constants.js'

export default function CarCard({ car, onBook }) {
  const image = car.images?.[0]

  return (
    <article className="car-card">
      <div className="car-card__image">
        {image ? (
          <img src={image} alt={car.name} loading="lazy" />
        ) : (
          <div className="car-card__placeholder">No image</div>
        )}
        <span className="badge badge--type">{typeLabel(car.type)}</span>
        {!car.isAvailable && <span className="badge badge--muted car-card__status">Unavailable</span>}
      </div>

      <div className="car-card__body">
        <h3 className="car-card__name">{car.name}</h3>
        <ul className="car-card__specs">
          <li>{car.seats} seats</li>
          <li>{capitalize(car.transmission)}</li>
          <li>{capitalize(car.fuel)}</li>
        </ul>
        <div className="car-card__footer">
          <p className="car-card__price">
            <strong>{formatPrice(car.pricePerDay, car.currency)}</strong>
            <span>/day</span>
          </p>
          <button
            className="btn btn--primary"
            onClick={() => onBook(car)}
            disabled={!car.isAvailable}
          >
            Book Now
          </button>
        </div>
      </div>
    </article>
  )
}
