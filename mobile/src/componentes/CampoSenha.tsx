import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native-paper';

/** Campo de senha com botão de mostrar/ocultar. */
export function CampoSenha(props: Omit<TextInputProps, 'secureTextEntry' | 'right'>) {
  const [visivel, setVisivel] = useState(false);
  return (
    <TextInput
      {...props}
      mode="outlined"
      secureTextEntry={!visivel}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      right={
        <TextInput.Icon
          icon={visivel ? 'eye-off' : 'eye'}
          onPress={() => setVisivel((v) => !v)}
          accessibilityLabel={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          forceTextInputFocus={false}
        />
      }
    />
  );
}
