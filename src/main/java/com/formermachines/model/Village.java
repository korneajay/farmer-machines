package com.formermachines.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "villages")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Village {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    private Integer xCoord;
    private Integer yCoord;
}
