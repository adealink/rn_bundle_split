import React from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet
} from 'react-native';
import ApiOfSampleB from './ApiOfSampleB';
import {
    FuncA, FuncB
} from 'example/src/modules';

class SampleB extends React.Component {
    render() {
        FuncA();
        FuncB();
        ApiOfSampleB();
        return (
            <View>
                <Image
                    style={styles.image}
                    source={require('../../assets/flexbox.jpg')}/>
                <Text>This is MainB</Text>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column'
    },
    image: {
        width: 355,
        height: 200
    }
});

const AppRegistry = require('AppRegistry');
AppRegistry.registerComponent('SampleB', () => SampleB);

module.exports = SampleB;
