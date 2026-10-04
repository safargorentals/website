import { capitalize, formatPrice, typeImage, typeLabel } from '../constants.js'
import Icon from './Icon.jsx'

// A car shown as a travel ticket: photo on top, specs, then a tear-off stub
// with the price and the booking button.
export default function CarCard({ car, days = 0, onBook }) {
  const ownImage = car.images?.[0]
  const fuel = car.fuel === 'cng' ? 'CNG' : capitalize(car.fuel)

  return (
    <article className={`sg-ticket ${car.isAvailable ? '' : 'is-off'}`}>
      <div className="sg-ticket__media">
        <img src={ownImage || typeImage(car.type)} alt={car.name} loading="lazy" />
        <span className="sg-ticket__type">{typeLabel(car.type)}</span>
        {car.isFeatured && <span className="sg-ticket__flag">Popular</span>}
        {!ownImage && <span className="sg-ticket__sample">Sample photo</span>}
        {!car.isAvailable && <span className="sg-ticket__status">Currently booked</span>}
      </div>

      <div className="sg-ticket__body">
        {car.brand && <p className="sg-ticket__brand">{car.brand}</p>}
        <h3>{car.name}</h3>
        <dl className="sg-ticket__specs">
          <div>
            <dt>Seats</dt>
            <dd>{car.seats}</dd>
          </div>
          <div>
            <dt>Gear</dt>
            <dd>{capitalize(car.transmission)}</dd>
          </div>
          <div>
            <dt>Fuel</dt>
            <dd>{fuel}</dd>
          </div>
        </dl>
      </div>

      <div className="sg-ticket__stub">
        <div className="sg-ticket__price">
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
        <button className="sg-btn sg-btn--yellow" onClick={() => onBook(car)} disabled={!car.isAvailable}>
          {car.isAvailable ? 'Book' : 'Booked'} <Icon name="arrow" size={16} />
        </button>
      </div>
    </article>
  )
}
