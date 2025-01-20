const { get } = require('../helper/http')
const { sumTokens2 } = require('../helper/unwrapLPs')

async function tvl(api) {
  let key = ''
  const pools = []

  // Fetch AMM Pools and process them
  do {
    const { pagination: { next_key }, pool } = await get('https://api.elys.network/elys-network/elys/amm/pool?pagination.count_total=true&pagination.per_page=1000&pagination.key=' + key)
    key = next_key
    pools.push(...pool)
  } while (key)

  // Loop through pools and aggregate the token amounts
  pools.forEach(pool => {
    pool.pool_assets.forEach(({ token: { denom, amount } }) => api.add(denom, amount))
  })

  // Fetch Leverage LP Pools and process positions
  const { params } = await get('https://api.elys.network/elys-network/elys/leveragelp/params')
  const enabledPools = params?.enabled_pools || []

  let totalLeverageLpCollateral = 0

  // Loop through enabled Leverage LP pools and aggregate collateral
  for (const poolId of enabledPools) {
    let nextKey = ''  // Pagination key for positions query
    do {
      const response = await get(`https://api.elys.network/elys-network/elys/leveragelp/positions-by-pool/${poolId}/${nextKey ? nextKey : ''}?pagination.count_total=true&pagination.per_page=1000`)
      nextKey = response.pagination?.next_key || ''
      
      response.positions.forEach(({ position: { collateral: { amount } } }) => {
        totalLeverageLpCollateral += parseFloat(amount)
      })
    } while (nextKey)
  }

  // Add the total collateral for Leverage LP pools to the API result
  api.add('USDC', totalLeverageLpCollateral)

  // Finally, return the sum of all tokens including the Leverage LP collateral
  return sumTokens2({ api })
}

module.exports = {
  elys: { tvl },
}
