import React,{useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import MapView,{Marker} from 'react-native-maps';
import SchematicMap from './MapSchematic';
import type {MapProps} from './MapSchematic';
import {colors} from './theme';
import {nativeMapConfig} from './config';
export default function NativeMap({lots,selected,onSelect}:MapProps){const [schematic,S]=useState(Platform.OS==='android'&&!nativeMapConfig.androidApiKeyConfigured);if(schematic)return <SchematicMap lots={lots} selected={selected} onSelect={onSelect}/>;return <View style={{height:300,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:colors.line}}><MapView style={{flex:1}} initialRegion={{latitude:51.122,longitude:71.427,latitudeDelta:.095,longitudeDelta:.1}} showsUserLocation={false} showsMyLocationButton={false}>{lots.map(l=><Marker key={l.id} coordinate={{latitude:+l.lat,longitude:+l.lng}} title={`${l.name} · DEMO`} description={`${l.price} KZT/hour · fictional inventory`} onPress={()=>onSelect(l.id)} pinColor={selected===l.id?colors.ink:colors.teal}/>)}</MapView><Pressable accessibilityRole="button" accessibilityLabel="Use offline schematic map" onPress={()=>S(true)} style={{position:'absolute',top:10,right:10,padding:10,backgroundColor:'white',borderRadius:9}}><Text style={{fontSize:10,color:colors.teal}}>Offline schematic</Text></Pressable><Text style={{position:'absolute',left:10,bottom:18,fontSize:9,backgroundColor:'#ffffffe6',padding:5,color:colors.ink}}>DEMO MARKERS · no live occupancy</Text></View>}
