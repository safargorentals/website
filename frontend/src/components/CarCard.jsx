import { capitalize, formatPrice, typeImage, typeLabel } from '../constants.js'
import Icon from './Icon.jsx'

export default function CarCard({ car, days = 0, onBook }) {
  const ownImage = car.images?.[0]

  return (
    <article className={`car-card ${car.isAvailable ? '' : 'car-card--off'}`}>
      <div className="car-card__image">
        <img src={ownImage || typeImage(car.type)} alt={car.name} loading="lazy" />
        <span className="car-card__type">{typeLabel(car.type)}</span>
        {car.isFeatured && <span className="car-card__flag">Popular</span>}
        {!ownImage && <span className="car-card__sample">Sample photo</span>}
        {!car.isAvailable && <span className="car-card__status">Currently booked</span>}
      </div>

      <div className="car-card__body">
        <div className="car-card__title">
          <h3>{car.name}</h3>
          {car.brand && <span>{car.brand}</span>}
        </div>

        <ul className="car-card__specs">
          <li>
            <Icon name="users" size={16} /> {car.seats} seats
          </li>
          <li>
            <Icon name="gear" size={16} /> {capitalize(car.transmission)}
          </li>
          <li>
            <Icon name="fuel" size={16} /> {car.fuel === 'cng' ? 'CNG' : capitalize(car.fuel)}
          </li>
        </ul>

        <div className="car-card__footer">
          <div className="car-card__price">
            <p>
              <strong>{formatPrice(car.pricePerDay, car.currency)}</strong>
              <span>/day</span>
            </p>
            {days > 0 && (
              <small>
                {formatPrice(car.pricePerDay * days, car.currency)} for {days} {days === 1 ? 'day' : 'days'}
              </small>
            )}
          </div>
          <button className="btn btn--primary" onClick={() => onBook(car)} disabled={!car.isAvailable}>
            Rent now
          </button>
        </div>
      </div>
    </article>
  )
}
