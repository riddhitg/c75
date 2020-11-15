import React from 'react';
import{Text,View,StyleSheet, Image, KeyboardAvoidingView, TouchableOpacity} from 'react-native';
import *as Permissions from 'expo-permissions';
import {BarCodeScanner} from 'expo-barcode-scanner';
import { TextInput } from 'react-native-gesture-handler';
import firebase from 'firebase';
import db from '../config';
import { ThemeColors } from 'react-navigation';

export default class TransactionScreen extends React.Component{
    constructor(){
        super();
        this.state = {
            hasCameraPermissions:null,
            scanned:false,
            scannedBookId:'',
            scannedStudentId:'',
            buttonState:'normal',
            transactionMessage:''
        }
    }

    getCameraPermissions = async(id)=>{
        const {status}=await Permissions.askAsync(Permissions.CAMERA);

        this.setState({
            /*
            status ==== "granted" is true when user has granted permissions
            status === "granted" is false when user has not granted the permission
            */
           hasCameraPermissions:status === "granted",
           buttonState:id,
           scanned:false  
        })
    }  
      
    handleBarCodeScanned = async({type,data})=>{
        const {buttonState} = this.state

        if(buttonState === "BookId"){
            this.setState({
                scanned:true,
                scannedBookId:data,
                buttonState:'normal'
            })
        }
        else if(buttonState === "StudentId"){
            this.setState({
                scanned:true,
                scannedStudentId:data,
                buttonState:'normal'
            })
        }
    }
    initiateBookIssue = async()=>{
        db.collection("transactions").add({
            'studentId':this.state.scannedStudentId,
            'bookId':this.state.scannedBookId,
            'date':firebase.firestore.Timestamp.now().toDate(),
            'transactionType':"issue"
        })

        db.collection("books").doc(this.state.scannedBookId).update({
            'bookAvailability':false
        })
        db.collection("students").doc(this.state.scannedStudentId).update({
            'numberOfBooksIssued':firebase.firestore.FieldValue.increment(1)
        })
    }
    initiateBookReturn = async()=>{
        db.collection("transactions").add({
            'studentId':this.state.scannedStudentId,
            'bookId':this.state.scannedBookId,
            'date':firebase.firestore.Timestamp.now().toDate(),
            'transactionType':"return"
        })

        db.collection("books").doc(this.state.scannedBookId).update({
            'bookAvailability':true
        })
        db.collection("students").doc(this.state.scannedStudentId).update({
            'numberOfBooksIssued':firebase.firestore.FieldValue.increment(-1)
        })
    }

    checkBookEligibility = async()=>{
        const bookRef = await db.collection("books").where("bookId", "==", this.state.scannedBookId).get()
        var transactionType = ""
        if(bookRef.docs.length === 0){
            transactionType = false;
            alert("the book never was there in the world's most low-buget school library")
        }
        else {
            bookRef.docs.map((doc)=>{
                var book = doc.data()
                if(book.bookAvailability){
                    transactionType = "Issue"
                }
                else {
                    transactionType = "Return"
                }
            })
        }
        return transactionType
    }
    checkStudentEligibilityForBookIssue = async()=>{
        const studentRef = await db.collection("students").where("studentId", "==", this.state.scannedStudentId).get()
        var isStudentEligible = ""
        if(studentRef.docs.length === 0){
            isStudentEligible = false;
            alert("the student never a part of the world's most low-buget school library")
            this.setState({
                scannedStudentId :'',
                scannedBookId :''
            })
        }
        else {
            studentRef.docs.map((doc)=>{
                var student = doc.data()
                if(student.numberOfBooksIssued<2){
                    isStudentEligible = true
                }
                else {
                    isStudentEligible = false;
                    alert("the student has taken 2 books from the world's most low-buget school library")
                    this.setState({
                        scannedStudentId :'',
                        scannedBookId :''
                    })
                }
            })
        }
        return isStudentEligible  
    }
    checkStudentEligibilityForBookReturn = async()=>{
        const transactionRef = await db.collection("transactions").where("bookId", "==", this.state.scannedBookId).limit(1).get()
        var isStudentEligible = ""
        transactionRef.docs.map((doc)=>{
            var lastBookTransaction = doc.data();
            if(lastBookTransaction.studentId === this.state.scannedStudentId){
                isStudentEligible = true
            }
            else {
                isStudentEligible = false;
                    alert("the student hasn't taken this books from the world's most low-buget school library")
                    this.setState({
                        scannedStudentId :'',
                        scannedBookId :''
                    })
            }
        })
        return isStudentEligible
    }


    handleTransaction = async()=>{
        var transactionType = await this.checkBookEligibility();
        if(!transactionType){
            alert("the book never was there in the world's most low-buget school library")
            this.setState({
                scannedStudentId:'',
                scannedBookId:''
            })
        }
        else if(transactionType === "Issue"){
            var isStudentEligible = await this.checkStudentEligibilityForBookIssue();
            if(isStudentEligible){
                this.initiateBookIssue()
                alert("Book from the world's low-buget school library is issued")
            }
        }
        else{
            var isStudentEligible = await this.checkStudentEligibilityForBookReturn();
            if(isStudentEligible){
                this.initiateBookReturn()
                alert("Book from the world's low-buget school library has been returned")
            }
        }
    }

    render(){
        const hasCameraPermissions = this.state.hasCameraPermissions;
        const scanned = this.state.scanned;
        const buttonState = this.state.buttonState;
        
        if(buttonState === "clicked" && hasCameraPermissions){
            return(
                <BarCodeScanner
                onBarCodeScanned = {scanned?undefined:this.handleBarCodeScanned}
                style = {StyleSheet.absoluteFillObject}/>
            )
        }
        else if(buttonState === "normal"){
            return(
                <KeyboardAvoidingView style = {styles.container} behavior = "padding" enabled>
                    <View>
                        <Image
                        source = {require("../assets/booklogo.jpg")}
                        style = {{width:200, height:200}}/>
                        <Text style = {{textAlign:'center', fonSize:20}}>Wily</Text>
                    </View>
                    <View style = {styles.inputView}>
                        <TextInput
                        style = {styles.inputBox}
                        placeholder = "BookId"
                        onChangeText = {text => this.setState({scannedBookId:text})}
                        value = {this.state.scannedBookId}/>
                        <TouchableOpacity
                         style = {styles.scanButton}
                         onPress = {()=>{
                             this.getCameraPermissions("BookId")
                         }}>
                             <Text style = {styles.buttonText}>Scan</Text>
                         </TouchableOpacity>
                    </View>
                    <View style = {styles.inputView}>
                        <TextInput
                        style = {styles.inputBox}
                        placeholder = "StudentId"
                        onChangeText = {text => this.setState({scannedStudentId:text})}
                        value = {this.state.scannedStudentId}/>
                        <TouchableOpacity
                         style = {styles.scanButton}
                         onPress = {()=>{
                             this.getCameraPermissions("StudentId")
                         }}>
                             <Text style = {styles.buttonText}>Scan</Text>
                         </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                    style = {styles.submitButton}
                    onPress = {async()=>{
                        var transactionMessage = await this.handleTransaction();
                    }}>
                        <Text style = {styles.submitButtonText}>Submit</Text>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            )
        }
    }
}
const styles = StyleSheet.create({
    container:{
        flex:1,
        justifyContent:'center',
        alignItems:'center'
    },
    displayText:{
        fontSize:15,
        textDecoration:'underline',
    },
    scanButton:{
        backgroundColor:'#2196f3',
        padding:10,
        margin:10
    },
    buttonText:{
        fonSize:20,
        textAlign:'center',
        marginTop:10
    },
    inputView:{
        flexDirection:'row',
        margin:20,
    },
    inputBox:{
        width:200,
        height:40,
        borderWidth:1.5,
        borderRightWidth:0,
        fontSize:20,
    },
    scanButton:{
        backgroundColor:'#66bb6a',
        width:50,
        borderWidth:1.5,
        borderLeftWidth:0
    },
    submitButton:{
        backgroundColor:'#fbc02d',
        width:100,
        height:50,
    },
    submitBuutonText:{
        padding:10,
        textAlign:'center',
        fontSize:20,
        fontWeight:"bold",
        color:'white'
    }
})