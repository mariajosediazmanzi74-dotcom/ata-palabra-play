import type { GameData } from "./types";

export const DEFAULT_DATA: GameData = {
  version: 1,
  names: { him: "Mateo", her: "Sofía" },
  conversations: [
    {
      id: "conv_hola",
      title: "¡Hola en la piñatería!",
      lines: [
        { id: "l1", speaker: "him", expression: "wave", text: "Hello! How are you today?", translation: "¡Hola! ¿Cómo estás hoy?" },
        { id: "l2", speaker: "her", expression: "talk", text: "I'm great, thank you! What are you doing?", translation: "¡Estoy muy bien, gracias! ¿Qué estás haciendo?" },
        { id: "l3", speaker: "him", expression: "point", text: "I'm looking for colorful piñatas.", translation: "Estoy buscando piñatas coloridas." },
        { id: "l4", speaker: "her", expression: "celebrate", text: "Let's explore the store together!", translation: "¡Exploremos la tienda juntos!" },
      ],
    },
    {
      id: "conv_elegir",
      title: "¿Cuál piñata elegimos?",
      lines: [
        { id: "l5", speaker: "her", expression: "point", text: "Look! There is a pink unicorn piñata.", translation: "¡Mira! Hay una piñata de unicornio rosada." },
        { id: "l6", speaker: "him", expression: "surprised", text: "Wow! It's huge and beautiful!", translation: "¡Guau! ¡Es enorme y hermosa!" },
        { id: "l7", speaker: "her", expression: "think", text: "Do you prefer the star or the llama?", translation: "¿Prefieres la estrella o la llama?" },
        { id: "l8", speaker: "him", expression: "think", text: "Hmm... I think the star is perfect for the party.", translation: "Mmm... creo que la estrella es perfecta para la fiesta." },
        { id: "l9", speaker: "her", expression: "laugh", text: "Great choice! Let's fill it with candy.", translation: "¡Gran elección! Llenémosla de dulces." },
        { id: "l10", speaker: "him", expression: "celebrate", text: "Yes! This party will be amazing!", translation: "¡Sí! ¡Esta fiesta será increíble!" },
      ],
    },
    {
      id: "conv_caja",
      title: "En la caja",
      lines: [
        { id: "l11", speaker: "him", expression: "talk", text: "Excuse me, how much is this piñata?", translation: "Disculpa, ¿cuánto cuesta esta piñata?" },
        { id: "l12", speaker: "her", expression: "point", text: "It's twenty dollars, and the balloons are free today!", translation: "Cuesta veinte dólares, ¡y los globos son gratis hoy!" },
        { id: "l13", speaker: "him", expression: "surprised", text: "Really? That's a great deal!", translation: "¿En serio? ¡Es una gran oferta!" },
        { id: "l14", speaker: "her", expression: "wave", text: "Thank you for shopping with us. Have a fun party!", translation: "Gracias por comprar con nosotros. ¡Que tengas una fiesta divertida!" },
        { id: "l15", speaker: "him", expression: "laugh", text: "Thank you! See you soon!", translation: "¡Gracias! ¡Hasta pronto!" },
      ],
    },
  ],
};
