// app/+not-found.tsx
import { Link } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>

      <Link href={"/(tabs)/Home"} style={styles.buttonStyle}>
        Go to Home Screen
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },

  buttonStyle: {
    color: "#ffffff",
    fontSize: 18,
    // marginTop: 20,
    textDecorationLine: "underline",
  },
});
