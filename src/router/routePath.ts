// Beispiel: routerHelper.replace(RoutePath.Login)
export enum RoutePath {
  Home = '/',
  Login = '/login',
  Account = '/konto',
  Admin = '/admin',

  PrivacyPolicy = '/datenschutz',
  Imprint = '/impressum',
  Credits = '/credits',
  Shop = '/shop',
  Shopping = '/shopping',
  ShoppingList = '/shoppinglist',
  ShoppingOverview = '/shoppingoverview',
  ShopItems = '/shopliste',
  ShopPrint = '/liste-drucken',
  ShopLists = '/alte-listen',
}

// Detailseite einer gedruckten Liste
export const shopListDetailPath = (id: number) => `${RoutePath.ShopLists}/${id}`
