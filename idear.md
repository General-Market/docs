1/ User
Place buy limit, sell limit, buy market, sell market, cancel, orders
2/ Issuer Network - 20 nodes
Agree on Buy, Sell, Transfer collateral orders, Authorize rebalacnce
Have access to Bitget account of AP in view mode view API.
Submit delisting/listing of new assets on bitget
3/ AP
Listent to list of trades to take onchain, and apply them.
4/ Contracts
Core 
Bridge - these are custody contracts, with whitelisted actions that keepr can push a Issuers BLS signature with
5/ Asset Manager
Propose rebalancing aggreed by issuer network

----
1.User submit orders.
2.Issuers each 1 seconds, batch all orders, submit a lock on all order from id x to id y, then submit list of trades for keeper to open or collateral transfer. (veirfied via BLS signature that each keepers verify, there is a random keeper leader ellected)
3.AP pick transfer orders and collateral orders and apply them if its Bitget, if its onchain order ( for transfer, anyone can push the order ( we have a keeper that autopush all orders )) (APs and Keepers are in read only)
4.Issuers sees orders, mark list of fill price of asset order, fill or not fill for limit order, approve cancel orders or fill order if collateral already filled, and new batch of transfer. 

---
Issuers nodes, are ellected by an admin ( that can be transfered )
Leader issuer is ellected randomly and determinsitcally by the hash of the last accepted BLS signature
Leader collect signature and submit onchain. Issuers nodes directly send to keeper, without waiting a new poke.
All issuers happens on an onchain registry with their IPs, so they can aut discver.
Issuer nodes can ellect with a BLS kicking an issuer node that doesn't answer ( need to recomput BLS and leader ellection ( same need to be done, when an issuer is added ))

At each cycle, issuers update mappig of target inventory, current inventory also. ( all bls submissions can be made in batches, question should we make multiple BLS or there is a way to make 1 big BLS that can be submited with sub data multiple time and efficiently gaz wise)

---
AP Bitget
he just submit orders ordered to him he sees onchain, and apply withdraws

---
Asset manager, 
He create the ITP fist with weights (that needs to be approved by issuser)
Once approved he can rebalance
On creation, we verify onchain, that asset he submited are equal to 1, and that he server assets that have been listed by the issuers.


--- Deslisting event
Its a rebalance event accepted by issuers
Keeper submit new weights to all indexes

--- Rebalance event
Issuers accept it, it changes, weights, then all new order follow same weights, and issuers follow an algo to smoothly rebalance all.
Rebalance events are batched, so there is a end of rebalances events, that only from that issuers start to rebalance their inventory.

--- Weights (fix formulas)
init price * assets weights * asset prices = list of qunatities for each ITPs (weigths)
current price = init price * average change weighted of each assets  
current price * new assets weights * new asset prices = list of qunatities for each ITPs at rebalance

Rebalance process : (by patches)
Issuers sell assets, recompute realistic quantities.
Issuers buys assets, recompute realistic quantit.
All ITPs are batch together, so if a non rebalance IPT buy 1 BTC and rebalance sell 1 BTC, we match the inventory. (strategy should be at issuer level to )