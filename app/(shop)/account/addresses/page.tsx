import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/index.ts'
import { addresses, orders } from '@/db/schema.ts'
import { requireUser } from '@/lib/auth.ts'
import { AccountShell, Panel } from '@/components/account/shell.tsx'
import { AddAddressForm } from '@/components/auth/account-forms.tsx'
import { setDefaultAddress, deleteAddress } from '@/app/actions/account.ts'
import { formatPhone } from '@/lib/phone.ts'

export default async function AddressesPage() {
  const user = await requireUser('/account/addresses')

  const [list, [{ orderCount }]] = await Promise.all([
    db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt)),
    db.select({ orderCount: sql<number>`count(*)::int` }).from(orders).where(eq(orders.userId, user.id)),
  ])

  return (
    <AccountShell
      user={user}
      active="/account/addresses"
      counts={{ orders: orderCount, '/account/orders': orderCount, '/account/addresses': list.length }}
    >
      <div className="flex flex-col gap-4">
        <Panel>
          <h1 className="font-display text-lg font-bold text-ink">
            Saved addresses{' '}
            <span className="text-sm font-normal text-faint">{list.length}</span>
          </h1>

          {list.length === 0 ? (
            <p className="mt-2 text-xs text-body">
              No addresses yet. Add one below so we know where to send your frames.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {list.map((a) => (
                <li
                  key={a.id}
                  className={`rounded-xl p-4 ${a.isDefault ? 'bg-violet-tint/40 ring-1 ring-violet-deep' : 'bg-subtle'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink">
                      {a.label || 'Address'}
                      {a.isDefault && (
                        <span className="ml-2 rounded-full bg-violet-tint px-2 py-[1px] text-[10px] font-bold text-violet-ink">
                          ✓ Default
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      {!a.isDefault && (
                        <form action={setDefaultAddress}>
                          <input type="hidden" name="id" value={a.id} />
                          <button className="text-[11px] font-semibold text-violet-deep">
                            Set as default
                          </button>
                        </form>
                      )}
                      <form action={deleteAddress}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-[11px] font-semibold text-faint hover:text-red-600">
                          Remove
                        </button>
                      </form>
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-body">
                    {a.name}
                    <br />
                    {formatPhone(a.phone)}
                    <br />
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}
                    <br />
                    {a.city}, {a.state} – {a.pincode}
                  </p>

                  {a.isDefault && (
                    <p className="mt-2 text-[11px] text-faint">Standard delivery address</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-base font-bold text-ink">Add an address</h2>
          <p className="mt-1 text-xs text-body">Provide shipping coordinates for dispatch.</p>
          <div className="mt-4">
            <AddAddressForm />
          </div>
        </Panel>
      </div>
    </AccountShell>
  )
}
