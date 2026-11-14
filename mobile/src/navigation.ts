import type {NavigatorScreenParams} from '@react-navigation/native';
export type TabRoutes={Explore:undefined;Search:undefined;Bookings:undefined;Profile:undefined};
export type RootRoutes={Welcome:undefined;SignIn:undefined;SignUp:undefined;Home:NavigatorScreenParams<TabRoutes>|undefined;Details:{lotId:string};Reservation:{lotId:string}};
