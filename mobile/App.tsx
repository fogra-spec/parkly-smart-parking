import React from 'react';
import {ActivityIndicator,StatusBar,Text,View} from 'react-native';
import {NavigationContainer,DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {ParklyProvider,useParkly} from './src/state';
import {Welcome,SignIn,SignUp} from './src/screens/Auth';
import {ParkingMap,ParkingDetails,SearchFilters} from './src/screens/Explore';
import {Reservation,MyBookings} from './src/screens/Booking';
import {ProfileScreen} from './src/screens/Profile';
import type {RootRoutes,TabRoutes} from './src/navigation';
import {colors,ui} from './src/theme';
const Stack=createNativeStackNavigator<RootRoutes>(),Tabs=createBottomTabNavigator<TabRoutes>();
const theme={...DefaultTheme,colors:{...DefaultTheme.colors,primary:colors.teal,background:colors.paper,card:colors.white,text:colors.ink,border:colors.line}};
const titles={Explore:'Parking Map',Search:'Search & Filters',Bookings:'My Bookings',Profile:'Profile'};
const icons={Explore:'map-outline',Search:'search-outline',Bookings:'calendar-outline',Profile:'person-outline'} as const;
function Home(){return <Tabs.Navigator screenOptions={({route})=>({title:titles[route.name],headerStyle:{backgroundColor:colors.paper},headerTitleStyle:{color:colors.ink,fontSize:17},headerShadowVisible:false,tabBarActiveTintColor:colors.teal,tabBarInactiveTintColor:'#92a087',tabBarStyle:{backgroundColor:colors.white,borderTopColor:colors.line},tabBarLabelStyle:{fontSize:10},tabBarIcon:({color,size})=><Ionicons name={icons[route.name]} color={color} size={size}/>})}><Tabs.Screen name="Explore" component={ParkingMap}/><Tabs.Screen name="Search" component={SearchFilters}/><Tabs.Screen name="Bookings" component={MyBookings}/><Tabs.Screen name="Profile" component={ProfileScreen}/></Tabs.Navigator>}
function Navigation(){const {data,loading}=useParkly();if(loading&&!data.lots.length)return <View style={ui.center}><ActivityIndicator color={colors.teal} size="large"/><Text style={ui.body}>Loading Parkly demo…</Text></View>;return <NavigationContainer theme={theme}><Stack.Navigator screenOptions={{headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false,contentStyle:{backgroundColor:colors.paper},headerTitleStyle:{fontSize:17},animation:'slide_from_right'}}>{data.user?<><Stack.Screen name="Home" component={Home} options={{headerShown:false}}/><Stack.Screen name="Details" component={ParkingDetails} options={{title:'Parking details'}}/><Stack.Screen name="Reservation" component={Reservation} options={{title:'Demo reservation'}}/></>:<><Stack.Screen name="Welcome" component={Welcome} options={{headerShown:false}}/><Stack.Screen name="SignIn" component={SignIn} options={{title:'Sign in'}}/><Stack.Screen name="SignUp" component={SignUp} options={{title:'Sign up'}}/></>}</Stack.Navigator></NavigationContainer>}
export default function App(){return <SafeAreaProvider><StatusBar barStyle="dark-content"/><ParklyProvider><Navigation/></ParklyProvider></SafeAreaProvider>}
