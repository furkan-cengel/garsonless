import { redirect } from 'next/navigation'
import { platformAdminCan } from '@garsonless/domain/platform-admin'
import { ADD_ON_DEFINITIONS } from '@garsonless/domain/entitlements'
import { formatAddOnMoney } from '@garsonless/domain/add-on-purchases'
import { createAddOnPurchasePort } from '@garsonless/db/server'
import { requirePlatformAdminActor } from '../../lib/platform-admin-auth'
import { PlatformShell } from '../PlatformShell'
import { updateAddOnPrice } from './actions'
export default async function AddOnCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>
}) {
  const actor = await requirePlatformAdminActor()
  if (!platformAdminCan(actor, 'catalog.manage')) redirect('/auth/denied')
  const history = await createAddOnPurchasePort().history()
  const prices = history.filter(
    (p) =>
      !history.some(
        (other) => other.addOn === p.addOn && other.version > p.version,
      ),
  )
  const { result } = await searchParams
  return (
    <PlatformShell actor={actor}>
      <h1>Eklentiler</h1>
      <p>
        Tek seferlik fiyatlar. Değişiklikler yalnız yeni ödeme oturumlarında
        geçerlidir.
      </p>
      {result && (
        <p role="status">
          {result === 'saved'
            ? 'Fiyat kaydedildi.'
            : result === 'conflict'
              ? 'Fiyat değişmiş olabilir. Güncel sürümü kontrol ederek tekrar dene.'
              : 'Fiyat veya vergi oranı geçersiz.'}
        </p>
      )}
      <div className="cards">
        {prices.map((price) => (
          <section className="panel" key={price.addOn}>
            <h2>{ADD_ON_DEFINITIONS[price.addOn].label}</h2>
            <form action={updateAddOnPrice}>
              <input type="hidden" name="addOn" value={price.addOn} />
              <input type="hidden" name="version" value={price.version} />
              <label>
                Tek seferlik fiyat (TL, KDV hariç)
                <input
                  name="price"
                  inputMode="decimal"
                  required
                  defaultValue={(price.netAmountMinor / 100).toFixed(2)}
                />
              </label>
              <label>
                KDV oranı
                <select name="vatRate" defaultValue={price.vatRate}>
                  {[0, 1, 10, 20].map((rate) => (
                    <option key={rate} value={rate}>
                      %{rate}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={price.active}
                />
                Satışa açık
              </label>
              <p>
                Geçerli toplam: {formatAddOnMoney(price.totalAmountMinor)} ·
                Sürüm {price.version}
              </p>
              <button className="button" type="submit">
                Yeni fiyat sürümünü kaydet
              </button>
            </form>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Fiyat geçmişi</h2>
        <table>
          <thead>
            <tr>
              <th>Eklenti</th>
              <th>Sürüm</th>
              <th>Net</th>
              <th>KDV</th>
              <th>Satış</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {history.map((p) => (
              <tr key={`${p.addOn}-${p.version}`}>
                <td>{ADD_ON_DEFINITIONS[p.addOn].label}</td>
                <td>{p.version}</td>
                <td>{formatAddOnMoney(p.netAmountMinor)}</td>
                <td>%{p.vatRate}</td>
                <td>{p.active ? 'Açık' : 'Kapalı'}</td>
                <td>{new Date(p.createdAt).toLocaleString('tr-TR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PlatformShell>
  )
}
